export type PlatformProvider = 'ssi' | 'binance' | 'fastapi';
export type PlatformCredentialRecord = { id: string; provider: PlatformProvider; environment: string; isActive: boolean };
export interface PlatformCredentialPort {
  list(userId: string): Promise<PlatformCredentialRecord[]>;
  get(userId: string, provider: PlatformProvider, environment?: string): Promise<Record<string, unknown>>;
  save(userId: string, provider: PlatformProvider, environment: string, credentials: Record<string, unknown>): Promise<PlatformCredentialRecord>;
  remove(userId: string, provider: PlatformProvider, environment?: string): Promise<void>;
}
