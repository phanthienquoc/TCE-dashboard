import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { CredentialsCryptoService } from './credentials-crypto.service';

export type PlatformProvider = 'ssi' | 'binance';

@Injectable()
export class PlatformCredentialsService {
  constructor(private readonly db: SupabaseClientService, private readonly crypto: CredentialsCryptoService) {}

  private assertProvider(provider: string): asserts provider is PlatformProvider {
    if (provider !== 'ssi' && provider !== 'binance') throw new Error('Unsupported platform');
  }

  async list(userId: string) {
    const { data, error } = await this.db.db.from('platform_credentials').select('id,provider,environment,is_active,last_tested_at,created_at,updated_at').eq('user_id', userId).order('provider');
    if (error) throw error;
    return data ?? [];
  }

  async save(userId: string, provider: string, environment: string, credentials: Record<string, unknown>) {
    this.assertProvider(provider);
    const encrypted = this.crypto.encrypt(credentials);
    const { data, error } = await this.db.db.from('platform_credentials').upsert({ user_id: userId, provider, environment, credentials_encrypted: encrypted, encryption_version: 1, is_active: true }, { onConflict: 'user_id,provider,environment' }).select('id,provider,environment,is_active,last_tested_at,created_at,updated_at').single();
    if (error) throw error;
    return data;
  }

  async getDecrypted(userId: string, provider: string, environment = 'production') {
    this.assertProvider(provider);
    const { data, error } = await this.db.db.from('platform_credentials').select('id,credentials_encrypted').eq('user_id', userId).eq('provider', provider).eq('environment', environment).eq('is_active', true).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Platform credentials not configured');
    return { id: data.id, credentials: this.crypto.decrypt(data.credentials_encrypted) };
  }

  async remove(userId: string, provider: string, environment = 'production') {
    this.assertProvider(provider);
    const { error } = await this.db.db.from('platform_credentials').update({ is_active: false }).eq('user_id', userId).eq('provider', provider).eq('environment', environment);
    if (error) throw error;
    return { ok: true };
  }
}
