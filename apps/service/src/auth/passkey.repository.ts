import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export interface PasskeyCredential {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
  friendly_name: string;
  created_at: string;
  last_used_at: string | null;
}

@Injectable()
export class PasskeyRepository {
  constructor(private readonly supabase: SupabaseClientService) {}

  async createChallenge(
    userId: string | null,
    challenge: string,
    purpose: 'registration' | 'authentication'
  ) {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error } = await this.supabase.db
      .from('auth_passkey_challenges')
      .insert({ user_id: userId, challenge, purpose, expires_at: expiresAt });
    if (error) throw error;
  }

  async consumeChallenge(challenge: string, purpose: 'registration' | 'authentication') {
    const { data, error } = await this.supabase.db
      .from('auth_passkey_challenges')
      .select('*')
      .eq('challenge', challenge)
      .eq('purpose', purpose)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    await this.supabase.db.from('auth_passkey_challenges').delete().eq('id', data.id);
    return data as {
      id: string;
      user_id: string | null;
      challenge: string;
      purpose: string;
      expires_at: string;
    };
  }

  async listForUser(userId: string) {
    const { data, error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PasskeyCredential[];
  }

  async findByCredentialId(credentialId: string) {
    const { data, error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .maybeSingle();
    if (error) throw error;
    return data as PasskeyCredential | null;
  }

  async createCredential(input: Omit<PasskeyCredential, 'id' | 'created_at' | 'last_used_at'>) {
    const { data, error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data as PasskeyCredential;
  }

  async updateCredential(id: string, counter: number, transports?: string[]) {
    const patch: Record<string, unknown> = { counter, last_used_at: new Date().toISOString() };
    if (transports) patch.transports = transports;
    const { error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  }

  async rename(userId: string, id: string, friendlyName: string) {
    const { error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .update({ friendly_name: friendlyName })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async remove(userId: string, id: string) {
    const { error } = await this.supabase.db
      .from('auth_passkey_credentials')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
