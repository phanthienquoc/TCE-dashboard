export type PlatformId = 'ssi' | 'binance';

export interface MarketQuote {
  platform: PlatformId;
  symbol: string;
  price: string;
  timestamp: number;
}

export interface Kline {
  platform: PlatformId;
  symbol: string;
  interval: string;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface TradingPlatform {
  readonly id: PlatformId;
  getQuote(symbol: string): Promise<MarketQuote>;
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
}
