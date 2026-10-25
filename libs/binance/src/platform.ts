import type { MarketDataPlatform, PlatformStatus } from '@tce/platform';

export interface BinancePlatform extends MarketDataPlatform {
  readonly kind: 'binance';
  getCandles(symbol: string, interval: string, limit?: number): Promise<unknown[]>;
}

export const BINANCE_PLATFORM_DEFAULTS: PlatformStatus = {
  provider: 'binance',
  configured: false,
  connected: false,
  environment: 'production',
  lastSyncAt: null,
  error: null,
};
