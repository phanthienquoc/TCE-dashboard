import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PostgresService } from './postgres.service';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
  user?: UserRow;
}

export interface RotatedSession {
  user_id: string;
  role: string;
  new_session_id: string;
  reuse_detected: boolean;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly postgres: PostgresService) {}

  async checkDatabase(): Promise<void> {
    await this.postgres.query('SELECT id FROM public.users LIMIT 1');
    await this.postgres.query('SELECT id FROM public.refresh_sessions LIMIT 1');
    await this.postgres.query('SELECT id FROM public.mfa_recovery_codes LIMIT 1');
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const result = await this.postgres.query<UserRow>(
      `SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted
       FROM public.users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()],
    );
    return result.rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const result = await this.postgres.query<UserRow>(
      `SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted
       FROM public.users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createUser(email: string, passwordHash: string): Promise<{
    id: string; email: string; role: string; mfa_enabled: boolean;
  }> {
    const result = await this.postgres.query<{
      id: string; email: string; role: string; mfa_enabled: boolean;
    }>(
      `INSERT INTO public.users (email, password_hash, role, mfa_enabled)
       VALUES ($1, $2, 'USER', false)
       RETURNING id, email, role, mfa_enabled`,
      [email.toLowerCase(), passwordHash],
    );
    const user = result.rows[0];
    if (!user) throw new Error('USER_INSERT_RETURNED_NO_ROW');
    return user;
  }

  async createSession(
    userId: string,
    tokenHash: string,
    familyId: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.postgres.query(
      `INSERT INTO public.refresh_sessions
         (user_id, token_hash, family_id, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5::inet, $6)`,
      [userId, tokenHash, familyId, expiresAt, ip ?? null, userAgent ?? null],
    );
  }

  async findSession(tokenHash: string): Promise<SessionRow | null> {
    const result = await this.postgres.query<SessionRow & {
      email: string;
      password_hash: string;
      role: string;
      mfa_enabled: boolean;
      mfa_secret_encrypted: string | null;
    }>(
      `SELECT s.id, s.user_id, s.token_hash, s.family_id, s.expires_at,
              s.revoked_at, u.email, u.password_hash, u.role,
              u.mfa_enabled, u.mfa_secret_encrypted
       FROM public.refresh_sessions s
       JOIN public.users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
       LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    const { email, password_hash, role, mfa_enabled, mfa_secret_encrypted, ...session } = row;
    return {
      ...session,
      user: { id: session.user_id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted },
    };
  }

  async touchSession(id: string): Promise<void> {
    await this.postgres.query(
      `UPDATE public.refresh_sessions
       SET last_used_at = now()
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [id],
    );
  }

  async rotateRefreshToken(
    tokenHash: string,
    newTokenHash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
  ): Promise<RotatedSession> {
    const outcome = await this.postgres.transaction(async (client: PoolClient) => {
      const result = await client.query<{
        id: string;
        user_id: string;
        family_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        role: string;
      }>(
        `SELECT s.id, s.user_id, s.family_id, s.expires_at, s.revoked_at, u.role
         FROM public.refresh_sessions s
         JOIN public.users u ON u.id = s.user_id
         WHERE s.token_hash = $1
         FOR UPDATE OF s`,
        [tokenHash],
      );
      const old = result.rows[0];
      if (!old) return { kind: 'invalid' as const };

      if (old.revoked_at) {
        // Match existing rotation behavior: replay revokes the whole active family.
        await client.query(
          `UPDATE public.refresh_sessions
           SET revoked_at = COALESCE(revoked_at, now())
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [old.family_id],
        );
        return { kind: 'reuse' as const, user_id: old.user_id, role: old.role };
      }

      if (new Date(old.expires_at).getTime() <= Date.now()) {
        return { kind: 'invalid' as const };
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.refresh_sessions
           (user_id, token_hash, family_id, expires_at, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)
         RETURNING id`,
        [old.user_id, newTokenHash, old.family_id, expiresAt, ip ?? null, userAgent ?? null],
      );
      const next = inserted.rows[0];
      if (!next) throw new Error('SESSION_ROTATION_INSERT_RETURNED_NO_ROW');

      await client.query(
        `UPDATE public.refresh_sessions
         SET replaced_by = $2, last_used_at = now(), revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL`,
        [old.id, next.id],
      );

      return {
        kind: 'rotated' as const,
        user_id: old.user_id,
        role: old.role,
        new_session_id: next.id,
      };
    });

    if (outcome.kind === 'invalid') {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Invalid refresh token' });
    }
    if (outcome.kind === 'reuse') {
      throw new UnauthorizedException({ code: 'REFRESH_TOKEN_REUSE', message: 'Refresh token reuse detected' });
    }
    return { ...outcome, reuse_detected: false };
  }

  async revokeSession(id: string): Promise<void> {
    await this.postgres.query(
      `UPDATE public.refresh_sessions
       SET revoked_at = now(), last_used_at = now()
       WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.postgres.query(
      `UPDATE public.refresh_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const result = await this.postgres.query<{ id: string }>(
      `WITH candidate AS (
         SELECT id
         FROM public.mfa_recovery_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE public.mfa_recovery_codes AS codes
       SET used_at = now()
       FROM candidate
       WHERE codes.id = candidate.id
       RETURNING codes.id`,
      [userId, codeHash],
    );
    return result.rowCount === 1;
  }
}
