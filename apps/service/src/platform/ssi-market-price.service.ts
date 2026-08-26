import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiApplicationService } from './ssi.application.service';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MARKET_HOURS = new Set([9, 10, 11, 12, 13, 14, 15]);

@Injectable()
export class SsiMarketPriceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private lastRunKey?: string;
  private running = false;

  constructor(private readonly ssi: SsiApplicationService, private readonly db: SupabaseClientService) {}

  onModuleInit() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private nowParts() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), minute: Number(get('minute')) };
  }
  private isWeekday(day: number) { return day >= 1 && day <= 5; }
  private tradingDate(p: ReturnType<SsiMarketPriceService['nowParts']>) { return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day.toString().padStart(2, '0')}`; }

  private async tick() {
    if (this.running) return;
    const now = this.nowParts();
    const weekday = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();
    if (!this.isWeekday(weekday)) return;
    const isHourly = now.minute === 0 && MARKET_HOURS.has(now.hour);
    const isClose = now.hour === 16 && now.minute === 0;
    if (!isHourly && !isClose) return;
    const runKey = `${this.tradingDate(now)}:${now.hour}:${isClose ? 'close' : 'hourly'}`;
    if (this.lastRunKey === runKey) return;
    this.lastRunKey = runKey;
    this.running = true;
    try { if (isClose) await this.syncDailyClose(this.tradingDate(now)); else await this.syncHourlyPrices(); }
    catch (error) { console.error('[SSI_MARKET_PRICE_SYNC]', error); }
    finally { this.running = false; }
  }

  private async usersAndSymbols() {
    const { data: accounts, error: accountError } = await this.db.db.from('tce_accounts').select('id,user_id').not('user_id', 'is', null);
    if (accountError) throw accountError;
    const byUser = new Map<string, Set<string>>();
    for (const account of accounts ?? []) {
      const userId = String(account.user_id);
      const [{ data: positions, error: positionsError }, { data: pools, error: poolsError }] = await Promise.all([
        this.db.db.from('tce_positions').select('symbol').eq('user_id', userId).neq('status', 'CLOSED'),
        this.db.db.from('tce_pool_entries').select('symbol').eq('account_id', account.id).eq('status', 'WATCHING'),
      ]);
      if (positionsError) throw positionsError;
      if (poolsError) throw poolsError;
      const symbols = byUser.get(userId) ?? new Set<string>();
      for (const row of [...(positions ?? []), ...(pools ?? [])]) {
        const symbol = String(row.symbol ?? '').trim().toUpperCase();
        if (symbol) symbols.add(symbol);
      }
      byUser.set(userId, symbols);
    }
    return [...byUser.entries()].filter(([, symbols]) => symbols.size).map(([userId, symbols]) => ({ userId, symbols: [...symbols] }));
  }

  private async syncHourlyPrices() {
    const users = await this.usersAndSymbols();
    const observedAt = new Date().toISOString();
    for (const user of users) {
      const quotes = await this.ssi.marketPrices(user.userId, 'production', user.symbols);
      if (!quotes.ok) { console.error('[SSI_MARKET_PRICE_USER]', user.userId, quotes.error); continue; }
      for (const quote of quotes.data) await this.persistPrice(user.userId, quote.symbol, quote.price, undefined, quote.tradingDate, observedAt);
    }
  }

  private async syncDailyClose(tradingDate: string) {
    const users = await this.usersAndSymbols();
    const observedAt = new Date().toISOString();
    for (const user of users) {
      const closes = await this.ssi.dailyCloses(user.userId, 'production', user.symbols, tradingDate);
      if (!closes.ok) { console.error('[SSI_DAILY_CLOSE_USER]', user.userId, closes.error); continue; }
      for (const close of closes.data) await this.persistPrice(user.userId, close.symbol, close.closePrice, close.closePrice, tradingDate, observedAt);
    }
  }

  private async persistPrice(userId: string, symbol: string, price: number, closePrice: number | undefined, tradingDate: string, observedAt: string) {
    const payload: Record<string, unknown> = { user_id: userId, symbol, trading_date: tradingDate, price, source: 'ssi', observed_at: observedAt, updated_at: observedAt };
    if (closePrice !== undefined) payload.close_price = closePrice;
    const { error: historyError } = await this.db.db.from('tce_market_prices').upsert(payload, { onConflict: 'user_id,symbol,trading_date' });
    if (historyError) throw historyError;
    const { data: positions, error: positionError } = await this.db.db.from('tce_positions').select('id,quantity,avg_cost').eq('user_id', userId).eq('symbol', symbol).neq('status', 'CLOSED');
    if (positionError) throw positionError;
    for (const position of positions ?? []) {
      const quantity = Number(position.quantity ?? 0);
      const avgCost = Number(position.avg_cost ?? 0);
      const { error } = await this.db.db.from('tce_positions').update({ market_price: price, market_value: quantity * price, unrealized_pnl: quantity * (price - avgCost), updated_at: observedAt }).eq('id', position.id);
      if (error) throw error;
    }
  }
}
