import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Kline, MarketQuote, TradingPlatform } from '../interfaces/trading-platform.interface';

@Injectable()
export class BinanceClient implements TradingPlatform {
  readonly id = 'binance' as const;
  private readonly baseUrl = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com';

  async getQuote(symbol: string): Promise<MarketQuote> {
    const data = await this.request<{ symbol: string; price: string }>(`/api/v3/ticker/price?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
    return { platform: this.id, symbol: data.symbol, price: data.price, timestamp: Date.now() };
  }

  async getKlines(symbol: string, interval: string, limit = 200): Promise<Kline[]> {
    const qs = new URLSearchParams({ symbol: symbol.toUpperCase(), interval, limit: String(Math.min(limit, 1000)) });
    const rows = await this.request<Array<[number,string,string,string,string,string,number,string,number,string,string,number]>>(`/api/v3/klines?${qs}`);
    return rows.map((r) => ({ platform: this.id, symbol: symbol.toUpperCase(), interval, openTime: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  /** Reserved for signed account/trading endpoints; live trading stays disabled by default. */
  sign(query: string, secret = process.env.BINANCE_API_SECRET ?? ''): string {
    return createHmac('sha256', secret).update(query).digest('hex');
  }
}
