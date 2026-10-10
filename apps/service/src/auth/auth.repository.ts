import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseClientService } from '../db/supabase.client';
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
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly postgres: PostgresService
  ) {}
  async checkDatabase(): Promise<void> {
    const requiredTables = [
      'users',
      'tce_accounts',
      'tce_positions',
      'tce_strategy_config',
      'tce_pool_entries',
      'tce_buy_candidates',
      'tce_orders',
    ];
    const checks = await Promise.all(
      requiredTables.map(table =>
        this.supabase.db.from(table).select('*', { head: true, count: 'exact' }).limit(1)
      )
    );
    const failed = checks.find(result => result.error);
    if (failed?.error) throw failed.error;
    // Auth rotation and recovery-code consumption use direct PostgreSQL transactions.
    await this.postgres.query('SELECT 1 FROM public.refresh_sessions LIMIT 1');
    await this.postgres.query('SELECT 1 FROM public.mfa_recovery_codes LIMIT 1');
  }
  async findUserByEmail(email: string): Promise<UserRow | null> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data as UserRow | null;
  }
  async findUserById(id: string): Promise<UserRow | null> {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as UserRow | null;
  }
  async createUser(
    email: string,
    passwordHash: string
  ): Promise<Pick<UserRow, 'id' | 'email' | 'role' | 'mfa_enabled'>> {
    const { data, error } = await this.supabase.db
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'USER',
        mfa_enabled: false,
      })
      .select('id,email,role,mfa_enabled')
      .single();
    if (error) throw error;
    return data as Pick<UserRow, 'id' | 'email' | 'role' | 'mfa_enabled'>;
  }
  async createRefreshSession(
    userId: string,
    tokenHash: string,
    familyId: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string
  ) {
    const { data, error } = await this.supabase.db
      .from('refresh_sessions')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        family_id: familyId,
        expires_at: expiresAt.toISOString(),
        ip: ip ?? null,
        user_agent: userAgent ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }
  async rotateRefreshToken(
    tokenHash: string,
    newTokenHash: string,
    expiresAt: Date,
    ip?: string,
    userAgent?: string
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
        [tokenHash]
      );
      const session = rows[0];
      if (!session) throw new UnauthorizedException('Invalid refresh token');

      // Replay revocation must commit. Return a result from the transaction and
      // throw only after the transaction wrapper commits.
      if (session.revoked_at || session.replaced_by) {
        await client.query(
          'UPDATE public.refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1 AND revoked_at IS NULL',
          [session.family_id]
        );
        return {
          user_id: session.user_id,
          role: session.role,
          new_session_id: '',
          reuse_detected: true
        };
      }
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        throw new UnauthorizedException('Expired refresh token');
      }

      const newSessionId = randomUUID();
      const { rowCount } = await client.query(
        'UPDATE public.refresh_sessions SET replaced_by = $2, revoked_at = now(), last_used_at = now() WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()',
        [session.id, newSessionId]
      );
      if (rowCount !== 1) {
        await client.query(
          'UPDATE public.refresh_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = $1 AND revoked_at IS NULL',
          [session.family_id]
        );
        return {
          user_id: session.user_id,
          role: session.role,
          new_session_id: '',
          reuse_detected: true
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
          userAgent ?? null
        ]
      );
      return {
        user_id: session.user_id,
        role: session.role,
        new_session_id: newSessionId,
        reuse_detected: false
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
        [userId, codeHash]
      );
      const recoveryCode = rows[0];
      if (!recoveryCode) return false;

      const { rowCount } = await client.query(
        'UPDATE public.mfa_recovery_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL',
        [recoveryCode.id]
      );
      return rowCount === 1;
    });
  }
}
