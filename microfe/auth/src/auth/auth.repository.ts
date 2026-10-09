import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { PostgresService } from './postgres.service';

export interface UserRow {
  id: string; email: string; password_hash: string; role: string;
  mfa_enabled: boolean; mfa_secret_encrypted: string | null;
}
export interface SessionRow {
  id: string; user_id: string; token_hash: string; family_id: string;
  expires_at: string; revoked_at: string | null; user?: UserRow;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: PostgresService) {}

  async checkDatabase(): Promise<void> {
    await this.db.query('SELECT 1 FROM public.users LIMIT 1');
    await this.db.query('SELECT 1 FROM public.refresh_sessions LIMIT 1');
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted FROM public.users WHERE lower(email) = lower($1) LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted FROM public.users WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  }

  async createUser(email: string, passwordHash: string) {
    try {
      const { rows } = await this.db.query<Pick<UserRow, 'id'|'email'|'role'|'mfa_enabled'>>(
        "INSERT INTO public.users (email, password_hash, role, mfa_enabled) VALUES (lower($1), $2, 'USER', false) RETURNING id, email, role, mfa_enabled",
        [email, passwordHash],
      );
      return rows[0];
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email already registered' });
      }
      throw error;
    }
  }

  async createSession(userId: string, tokenHash: string, familyId: string, expiresAt: Date, ip?: string, userAgent?: string): Promise<void> {
    await this.db.query(
      'INSERT INTO public.refresh_sessions (user_id, token_hash, family_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5::inet, $6)',
      [userId, tokenHash, familyId, expiresAt.toISOString(), ip ?? null, userAgent ?? null],
    );
  }

  async findSession(tokenHash: string): Promise<SessionRow | null> {
    const { rows } = await this.db.query<SessionRow>(
      "SELECT id, user_id, token_hash, family_id, expires_at, revoked_at FROM public.refresh_sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1",
      [tokenHash],
    );
    const session = rows[0];
    if (!session) return null;
    const user = await this.findUserById(session.user_id);
    if (!user) return null;
    return { ...session, user };
  }

  async touchSession(id: string): Promise<void> {
    await this.db.query('UPDATE public.refresh_sessions SET last_used_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
  }

  async rotateRefreshToken(tokenHash: string, newTokenHash: string, expiresAt: Date, ip?: string, userAgent?: string) {
    return this.db.transaction(async client => {
      const { rows } = await client.query<SessionRow & { replaced_by: string | null }>(
        'SELECT id, user_id, token_hash, family_id, expires_at, revoked_at, replaced_by FROM public.refresh_sessions WHERE token_hash = $1 FOR UPDATE',
        [tokenHash],
      );
      const session = rows[0];
      if (!session) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Invalid refresh token' });

      if (session.revoked_at || session.expires_at <= new Date().toISOString() || session.replaced_by) {
        if (session.revoked_at || session.replaced_by) {
          await client.query(
            'UPDATE public.refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1 AND revoked_at IS NULL',
            [session.family_id],
          );
          throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSE', message: 'Refresh token reuse detected' });
        }
        throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Expired refresh token' });
      }

      const user = await client.query<{ role: string }>('SELECT role FROM public.users WHERE id = $1 LIMIT 1', [session.user_id]);
      if (!user.rows[0]) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'User no longer exists' });
      const newId = randomUUID();
      const created = await client.query(
        'INSERT INTO public.refresh_sessions (id, user_id, token_hash, family_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6::inet, $7)',
        [newId, session.user_id, newTokenHash, session.family_id, expiresAt.toISOString(), ip ?? null, userAgent ?? null],
      );
      if (created.rowCount !== 1) throw new Error('REFRESH_ROTATION_FAILED');
      const updated = await client.query(
        'UPDATE public.refresh_sessions SET revoked_at = now(), replaced_by = $2, last_used_at = now() WHERE id = $1 AND revoked_at IS NULL',
        [session.id, newId],
      );
      if (updated.rowCount !== 1) throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSE', message: 'Refresh token already used' });
      return { user_id: session.user_id, role: user.rows[0].role, new_session_id: newId, reuse_detected: false };
    });
  }

  async revokeSession(id: string): Promise<void> {
    await this.db.query('UPDATE public.refresh_sessions SET revoked_at = now(), last_used_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.query('UPDATE public.refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    return this.db.transaction(async client => {
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM public.mfa_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL FOR UPDATE',
        [userId, codeHash],
      );
      if (!rows[0]) return false;
      const { rowCount } = await client.query(
        'UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL',
        [rows[0].id],
      );
      return rowCount === 1;
    });
  }
}
