import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiApplicationService } from './ssi.application.service';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MARKET_HOURS = new Set([9, 10, 11, 13, 14]);

type SyncUserError = { userId: string; code: string; message: string; symbols: string[] };
type MarketSyncResult = { usersProcessed: number; usersSynced: number; symbolsRequested: number; symbolsSynced: number; failedSymbols: string[]; errors: SyncUserError[]; partial: boolean };

@Injectable()
export class SsiMarketPriceService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private lastRunKey?: string;
  private running = false;
  constructor(private readonly ssi: SsiApplicationService, private readonly db: SupabaseClientService) {}
  onModuleInit() { void this.tick(); this.timer = setInterval(() => void this.tick(), 60_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async syncNow(userId: string) {
    if (this.running) return { ok: false as const, error: { code: 'SYNC_IN_PROGRESS', message: 'SSI market sync is already running' } };
    this.running = true;
    try {
      const result = await this.syncHourlyPrices(userId);
      if (result.symbolsRequested > 0 && result.symbolsSynced === 0) return { ok: false as const, error: { code: result.errors[0]?.code ?? 'NO_MARKET_PRICES', message: result.errors[0]?.message ?? 'SSI returned no market prices' }, data: { ...result, syncedAt: new Date().toISOString() } };
      return { ok: true as const, data: { ...result, syncedAt: new Date().toISOString() } };
    } catch (error) {
      console.error('[SSI_MARKET_PRICE_MANUAL_SYNC]', error);
      return { ok: false as const, error: { code: 'SYNC_FAILED', message: error instanceof Error ? error.message : String(error) } };
    } finally { this.running = false; }
  }

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
    this.running = true;
    try { if (isClose) await this.syncDailyClose(this.tradingDate(now)); else await this.syncHourlyPrices(); this.lastRunKey = runKey; }
    catch (error) { console.error('[SSI_MARKET_PRICE_SYNC]', error); }
    finally { this.running = false; }
  }

  private async usersAndSymbols(userId?: string) {
    let query = this.db.db.from('tce_accounts').select('id,user_id').not('user_id', 'is', null);
    if (userId) query = query.eq('user_id', userId);
    const { data: accounts, error: accountError } = await query;
    if (accountError) throw accountError;
    const byUser = new Map<string, Set<string>>();
    for (const account of accounts ?? []) {
      const accountUserId = String(account.user_id), accountId = String(account.id);
      const [{ data: positions, error: positionsError }, { data: pools, error: poolsError }] = await Promise.all([
        this.db.db.from('tce_positions').select('symbol').eq('account_id', accountId).neq('status', 'CLOSED'),
        this.db.db.from('tce_pool_entries').select('symbol').eq('account_id', accountId).eq('status', 'WATCHING'),
      ]);
      if (positionsError) throw positionsError;
      if (poolsError) throw poolsError;
      const symbols = byUser.get(accountUserId) ?? new Set<string>();
      for (const row of [...(positions ?? []), ...(pools ?? [])]) { const symbol = String(row.symbol ?? '').trim().toUpperCase(); if (symbol) symbols.add(symbol); }
      byUser.set(accountUserId, symbols);
    }
    return [...byUser.entries()].filter(([, symbols]) => symbols.size).map(([accountUserId, symbols]) => ({ userId: accountUserId, symbols: [...symbols] }));
  }

  private async syncHourlyPrices(userId?: string): Promise<MarketSyncResult> {
    const users = await this.usersAndSymbols(userId), observedAt = new Date().toISOString();
    let usersSynced = 0, symbolsRequested = 0, symbolsSynced = 0;
    const failedSymbols = new Set<string>(), errors: SyncUserError[] = [];
    for (const user of users) {
      symbolsRequested += user.symbols.length;
      const quotes = await this.ssi.marketPrices(user.userId, 'production', user.symbols);
      if (!quotes.ok) { console.error('[SSI_MARKET_PRICE_USER]', user.userId, quotes.error); user.symbols.forEach((symbol) => failedSymbols.add(symbol)); errors.push({ userId: user.userId, code: quotes.error.code, message: quotes.error.message, symbols: user.symbols }); continue; }
      usersSynced += 1;
      const returnedSymbols = new Set(quotes.data.map((quote) => quote.symbol.toUpperCase()));
      const missing = user.symbols.filter((symbol) => !returnedSymbols.has(symbol));
      const fallbackSymbols = new Set<string>();
      if (missing.length) {
        const tradingDate = this.tradingDate(this.nowParts());
        const fallback = await this.ssi.dailyCloses(user.userId, 'production', missing, tradingDate);
        if (fallback.ok) {
          for (const close of fallback.data) {
            const symbol = close.symbol.toUpperCase();
            fallbackSymbols.add(symbol);
            await this.persistPrice(user.userId, symbol, close.closePrice, close.closePrice, tradingDate, observedAt);
            symbolsSynced += 1;
          }
        }
      }
      const unresolved = missing.filter((symbol) => !fallbackSymbols.has(symbol) && !returnedSymbols.has(symbol));
      unresolved.forEach((symbol) => failedSymbols.add(symbol));
      if (unresolved.length) errors.push({ userId: user.userId, code: 'PARTIAL_MARKET_DATA', message: `SSI returned no usable market data for ${unresolved.length}/${user.symbols.length} requested symbols`, symbols: unresolved });
      for (const quote of quotes.data) {
        await this.persistPrice(user.userId, quote.symbol, quote.price, undefined, quote.tradingDate, observedAt);
        symbolsSynced += 1;
      }
    }
    return { usersProcessed: users.length, usersSynced, symbolsRequested, symbolsSynced, failedSymbols: [...failedSymbols].sort(), errors, partial: symbolsSynced > 0 && symbolsSynced < symbolsRequested };
  }

  private async syncDailyClose(tradingDate: string) {
    const users = await this.usersAndSymbols(), observedAt = new Date().toISOString();
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
      const quantity = Number(position.quantity ?? 0), avgCost = Number(position.avg_cost ?? 0);
      const { error } = await this.db.db.from('tce_positions').update({ market_price: price, market_value: quantity * price, unrealized_pnl: quantity * (price - avgCost), updated_at: observedAt }).eq('id', position.id);
      if (error) throw error;
    }
  }
}
