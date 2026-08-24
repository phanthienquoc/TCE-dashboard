export type PlatformKind = 'ssi' | 'binance' | 'fastapi';

export type PlatformStatus = {
  provider: PlatformKind;
  configured: boolean;
  connected: boolean;
  environment: 'development' | 'staging' | 'production';
  lastSyncAt?: string | null;
  error?: string | null;
};

export interface TradingPlatform {
  readonly kind: PlatformKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  health(): Promise<PlatformStatus>;
}

export interface MarketDataPlatform extends TradingPlatform {
  getQuotes(symbols: string[]): Promise<Record<string, number>>;
}

export interface AccountDataPlatform extends TradingPlatform {
  getPositions(accountId: string): Promise<unknown[]>;
  getOrders(accountId: string): Promise<unknown[]>;
  getBalance(accountId: string): Promise<Record<string, number>>;
}
