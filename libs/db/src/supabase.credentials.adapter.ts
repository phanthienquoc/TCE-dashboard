import { PlatformCredentialPort, PlatformProvider } from '@tce/contracts';
import { SupabaseClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const DEFAULT_NAME = 'default';
export class SupabaseCredentialAdapter implements PlatformCredentialPort {
  private readonly key: Buffer;
  constructor(
    private readonly db: SupabaseClient,
    encryptionKey: string
  ) {
    this.key = Buffer.from(encryptionKey, 'hex');
    if (this.key.length !== 32)
      throw new Error('TCE_CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters');
  }
  private encrypt(value: Record<string, unknown>) {
    return this.encryptText(JSON.stringify(value));
  }
  private encryptText(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }
  private decrypt(payload: string): Record<string, unknown> {
    return JSON.parse(this.decryptText(payload)) as Record<string, unknown>;
  }
  private decryptText(payload: string): string {
    const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
    if (version !== VERSION || !ivRaw || !tagRaw || !ciphertextRaw)
      throw new Error('Invalid encrypted credentials');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
  async list(userId: string) {
    const { data, error } = await this.db
      .from('platform_credentials')
      .select('id,provider,environment,credential_name,is_active')
      .eq('user_id', userId)
      .order('provider')
      .order('credential_name');
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id,
      provider: r.provider as PlatformProvider,
      environment: r.environment,
      name: r.credential_name ?? DEFAULT_NAME,
      isActive: Boolean(r.is_active),
    }));
  }
  async get(
    userId: string,
    provider: PlatformProvider,
    environment = 'production',
    name = DEFAULT_NAME
  ) {
    const { data, error } = await this.db
      .from('platform_credentials')
      .select('credentials_encrypted,ssi_client_id_encrypted')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('environment', environment)
      .eq('credential_name', name)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Platform credentials not configured');
    const credentials = this.decrypt(data.credentials_encrypted);
    if (provider === 'ssi' && data.ssi_client_id_encrypted)
      credentials.clientId = this.decryptText(data.ssi_client_id_encrypted);
    return credentials;
  }
  async save(
    userId: string,
    provider: PlatformProvider,
    environment: string,
    credentials: Record<string, unknown>,
    name = DEFAULT_NAME
  ) {
    const credentialName = name.trim() || DEFAULT_NAME;
    const encrypted = this.encrypt(credentials);
    const row: Record<string, unknown> = {
      user_id: userId,
      provider,
      environment,
      credential_name: credentialName,
      credentials_encrypted: encrypted,
      encryption_version: 1,
      is_active: true,
    };
    if (provider === 'ssi') {
      row.ssi_account_no = credentials.accountNo ? String(credentials.accountNo) : null;
      row.ssi_client_id_encrypted = credentials.clientId ? this.encryptText(String(credentials.clientId)) : null;
    }
    const { data, error } = await this.db
      .from('platform_credentials')
      .upsert(row, { onConflict: 'user_id,provider,environment,credential_name' })
      .select('id,provider,environment,credential_name,is_active')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      provider: data.provider as PlatformProvider,
      environment: data.environment,
      name: data.credential_name ?? DEFAULT_NAME,
      isActive: Boolean(data.is_active),
    };
  }
  async remove(
    userId: string,
    provider: PlatformProvider,
    environment = 'production',
    name = DEFAULT_NAME
  ) {
    const { error } = await this.db
      .from('platform_credentials')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('environment', environment)
      .eq('credential_name', name);
    if (error) throw error;
  }
}
