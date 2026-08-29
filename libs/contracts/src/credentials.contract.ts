export type PlatformProvider = 'ssi' | 'binance' | 'fastapi' | 'telegram';
export type PlatformCredentialRecord = {
  id: string;
  provider: PlatformProvider;
  environment: string;
  name: string;
  isActive: boolean;
};
export interface PlatformCredentialPort {
  list(userId: string): Promise<PlatformCredentialRecord[]>;
  get(
    userId: string,
    provider: PlatformProvider,
    environment?: string,
    name?: string
  ): Promise<Record<string, unknown>>;
  save(
    userId: string,
    provider: PlatformProvider,
    environment: string,
    credentials: Record<string, unknown>,
    name?: string
  ): Promise<PlatformCredentialRecord>;
  remove(
    userId: string,
    provider: PlatformProvider,
    environment?: string,
    name?: string
  ): Promise<void>;
}
