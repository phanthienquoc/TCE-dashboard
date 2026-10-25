import type { PlatformStatus, TradingPlatform } from '@tce/platform';

export interface FastApiPlatform extends TradingPlatform {
  readonly kind: 'fastapi';
  getHealth(): Promise<Record<string, unknown>>;
  getMarketSnapshot(symbols?: string[]): Promise<Record<string, unknown>>;
}

export const FASTAPI_PLATFORM_DEFAULTS: PlatformStatus = {
  provider: 'fastapi',
  configured: false,
  connected: false,
  environment: 'production',
  lastSyncAt: null,
  error: null,
};
