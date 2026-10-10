import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../db/postgres.client';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'USER' | 'ADMIN';
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly postgres: PostgresService) {}

  async checkDatabase(): Promise<void> {
    for (const table of [
      'users',
      'refresh_sessions',
      'mfa_recovery_codes',
      'auth_passkey_challenges',
      'auth_passkey_credentials',
    ]) {
      await this.postgres.query(`SELECT 1 FROM public.${table} LIMIT 1`);
    }
  }

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.postgres.query<UserRow>(
      'SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted FROM public.users WHERE lower(email) = lower($1) LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const { rows } = await this.postgres.query<UserRow>(
      'SELECT id, email, password_hash, role, mfa_enabled, mfa_secret_encrypted FROM public.users WHERE id = $1 LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  }

  async createUser(
    email: string,
    passwordHash: string,
  ): Promise<Pick<UserRow, 'id' | 'email' | 'role' | 'mfa_enabled'>> {
    try {
      const { rows } = await this.postgres.query<
        Pick<UserRow, 'id' | 'email' | 'role' | 'mfa_enabled'>
      >(
        "INSERT INTO public.users (email, password_hash, role, mfa_enabled) VALUES (lower($1), $2, 'USER', false) RETURNING id, email, role, mfa_enabled",
        [email, passwordHash],
      );
      if (!rows[0]) throw new Error('Unable to create user');
      return rows[0];
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException({ code: 'EMAIL_EXISTS', message: 'Email already registered' });
      }
      throw error;
    }
  }

  async createRefreshSession(
    userId: string,
    tokenHash: string,
    familyId: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const { rows } = await this.postgres.query<{ id: string }>(
      'INSERT INTO public.refresh_sessions (user_id, token_hash, family_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5::inet, $6) RETURNING id',
      [userId, tokenHash, familyId, expiresAt.toISOString(), ip ?? null, userAgent ?? null],
    );
    if (!rows[0]) throw new Error('Unable to create refresh session');
    return rows[0].id;
  }

  async rotateRefreshToken(
    tokenHash: string,
    newTokenHash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string,
  ) {
    const result = await this.postgres.transaction(async client => {
      const { rows } = await client.query<{
        id: string;
        user_id: string;
        family_id: string;
        expires_at: string | Date;
        revoked_at: string | null;
        replaced_by: string | null;
        role: 'USER' | 'ADMIN';
      }>(
        'SELECT s.id, s.user_id, s.family_id, s.expires_at, s.revoked_at, s.replaced_by, u.role FROM public.refresh_sessions s JOIN public.users u ON u.id = s.user_id WHERE s.token_hash = $1 FOR UPDATE OF s',
        [tokenHash],
      );
      const session = rows[0];
      if (!session) throw new UnauthorizedException('Invalid refresh token');

      // Return a replay signal from the transaction so family revocation commits
      // before the service throws an UnauthorizedException.
      if (session.revoked_at || session.replaced_by) {
        await client.query(
          'UPDATE public.refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1 AND revoked_at IS NULL',
          [session.family_id],
        );
        return {
          user_id: session.user_id,
          role: session.role,
          new_session_id: '',
          reuse_detected: true,
        };
      }

      if (new Date(session.expires_at).getTime() <= Date.now()) {
        throw new UnauthorizedException('Expired refresh token');
      }

      const newSessionId = randomUUID();
      const { rowCount } = await client.query(
        'UPDATE public.refresh_sessions SET replaced_by = $2, revoked_at = now(), last_used_at = now() WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()',
        [session.id, newSessionId],
      );

      if (rowCount !== 1) {
        await client.query(
          'UPDATE public.refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1 AND revoked_at IS NULL',
          [session.family_id],
        );
        return {
          user_id: session.user_id,
          role: session.role,
          new_session_id: '',
          reuse_detected: true,
        };
      }

      await client.query(
        'INSERT INTO public.refresh_sessions (id, user_id, token_hash, family_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6::inet, $7)',
        [
          newSessionId,
          session.user_id,
          newTokenHash,
          session.family_id,
          expiresAt.toISOString(),
          ip ?? null,
          userAgent ?? null,
        ],
      );

      return {
        user_id: session.user_id,
        role: session.role,
        new_session_id: newSessionId,
        reuse_detected: false,
      };
    });

    if (result.reuse_detected) {
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return result;
  }

  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    return this.postgres.transaction(async client => {
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM public.mfa_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED',
        [userId, codeHash],
      );
      const recoveryCode = rows[0];
      if (!recoveryCode) return false;

      const { rowCount } = await client.query(
        'UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL',
        [recoveryCode.id],
      );
      return rowCount === 1;
    });
  }
}
