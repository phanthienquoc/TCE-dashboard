import { Injectable } from '@nestjs/common';
import type { Kline, MarketQuote, TradingPlatform } from '../interfaces/trading-platform.interface';

type SsiTokenResponse = { accessToken: string; expiresAt: number; refreshToken?: string };

@Injectable()
export class SsiClient implements TradingPlatform {
  readonly id = 'ssi' as const;
  private readonly baseUrl = process.env.SSI_BASE_URL ?? 'https://api.ssi.com.vn';
  private token?: SsiTokenResponse;

  async authenticate(otp?: string): Promise<SsiTokenResponse> {
    const apiKey = process.env.SSI_API_KEY;
    const apiSecret = process.env.SSI_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error('SSI_API_KEY and SSI_API_SECRET are required');
    const body: Record<string, string> = { apiKey, apiSecret };
    if (otp) body.otp = otp;
    const res = await fetch(`${this.baseUrl}/api/v3/auth/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`SSI auth ${res.status}: ${await res.text()}`);
    this.token = await res.json() as SsiTokenResponse;
    return this.token;
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const data = await this.request<any>(`/api/v3/market/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
    const price = data?.data?.[0]?.lastPrice ?? data?.data?.[0]?.price ?? data?.lastPrice ?? data?.price;
    if (price == null) throw new Error('SSI quote response did not contain a price');
    return { platform: this.id, symbol: symbol.toUpperCase(), price: String(price), timestamp: Date.now() };
  }

  async getKlines(symbol: string, interval: string, limit = 200): Promise<Kline[]> {
    const endpoint = interval === '1d' ? '1day' : interval.replace('m', 'minute').replace('h', 'hour');
    const data = await this.request<any>(`/api/v3/market/ohlc/${endpoint}?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return rows.slice(-Math.min(limit, 1000)).map((r: any) => ({ platform: this.id, symbol: symbol.toUpperCase(), interval, openTime: new Date(r.tradingDate ?? r.trading_date ?? r.openTime).getTime(), open: String(r.openPrice ?? r.open_price ?? r.open), high: String(r.highPrice ?? r.high_price ?? r.high), low: String(r.lowPrice ?? r.low_price ?? r.low), close: String(r.closePrice ?? r.close_price ?? r.close), volume: String(r.volume) }));
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.token || this.token.expiresAt <= Date.now() + 30_000) await this.authenticate();
    const res = await fetch(`${this.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.token!.accessToken}` } });
    if (!res.ok) throw new Error(`SSI ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
}
