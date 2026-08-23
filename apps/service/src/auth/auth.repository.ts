import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export interface UserRow { id: string; email: string; password_hash: string; role: 'USER'|'ADMIN'; mfa_enabled: boolean; mfa_secret_encrypted: string|null; }

@Injectable()
export class AuthRepository {
  constructor(private readonly supabase: SupabaseClientService) {}
  async checkDatabase(): Promise<void> { const { error } = await this.supabase.db.from('users').select('id').limit(1); if (error) throw error; }
  async findUserByEmail(email: string): Promise<UserRow|null> { const { data, error } = await this.supabase.db.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle(); if (error) throw error; return data as UserRow|null; }
  async findUserById(id: string): Promise<UserRow|null> { const { data, error } = await this.supabase.db.from('users').select('*').eq('id', id).maybeSingle(); if (error) throw error; return data as UserRow|null; }
  async createRefreshSession(userId: string, tokenHash: string, familyId: string, expiresAt: Date, ip?: string, userAgent?: string) {
    const { data, error } = await this.supabase.db.from('refresh_sessions').insert({ user_id:userId, token_hash:tokenHash, family_id:familyId, expires_at:expiresAt.toISOString(), ip:ip ?? null, user_agent:userAgent ?? null }).select('id').single();
    if (error) throw error; return data.id as string;
  }
  async rotateRefreshToken(tokenHash: string, newTokenHash: string, expiresAt: Date, ip?: string, userAgent?: string) {
    const { data, error } = await this.supabase.db.rpc('rotate_refresh_token', { p_token_hash:tokenHash, p_new_token_hash:newTokenHash, p_new_expires_at:expiresAt.toISOString(), p_ip:ip ?? null, p_user_agent:userAgent ?? null });
    if (error) throw error; const row = Array.isArray(data) ? data[0] : data; if (!row) throw new UnauthorizedException('Invalid refresh token'); if (row.reuse_detected) throw new UnauthorizedException('Refresh token reuse detected'); return row as { user_id:string; role:'USER'|'ADMIN'; new_session_id:string; reuse_detected:boolean };
  }
  async consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean> { const { data, error } = await this.supabase.db.rpc('consume_recovery_code', { p_user_id:userId, p_code_hash:codeHash }); if (error) throw error; return data === true; }
}
