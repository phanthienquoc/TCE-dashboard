import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiApplicationService } from '../platform/ssi.application.service';

const DEFAULT_DAYS = 365;
const TIMEZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class DividendOhlcvService {
  constructor(
    private readonly db: SupabaseClientService,
    private readonly ssi: SsiApplicationService,
  ) {}

  async getHistory(symbolInput: string, days = DEFAULT_DAYS) {
    const symbol = normalizeSymbol(symbolInput);
    await this.assertDividendSymbol(symbol);
    const rangeDays = clampDays(days);
    const from = addDays(todayVietnam(), -(rangeDays - 1));
    const { data, error } = await this.db.db
      .from('tce_market_ohlcv_daily')
      .select('symbol,trading_date,open,high,low,close,volume')
      .eq('symbol', symbol)
      .gte('trading_date', from)
      .order('trading_date', { ascending: true })
      .limit(rangeDays + 5);
    if (error) throw error;
    return data ?? [];
  }

  async syncDividendSymbols(userId: string, environment = 'production', fromDate?: string, toDate?: string) {
    const symbols = await this.dividendSymbols();
    const endDate = toDate ?? todayVietnam();
    const fallbackStart = fromDate ?? addDays(endDate, -(DEFAULT_DAYS - 1));
    let syncedSymbols = 0;
    let syncedRows = 0;

    for (const symbol of symbols) {
      const range = await this.resolveRange(symbol, fallbackStart, endDate);
      if (!range) continue;

      let symbolRows = 0;
      for (const batch of monthBatches(range.from, endDate)) {
        const result = await this.ssi.dailyOhlcv(
          userId,
          environment,
          [symbol],
          batch.from,
          batch.to,
        );
        if (!result.ok) throw new Error(result.error.message);

        const now = new Date().toISOString();
        const rows = result.data
          .filter(item => item.tradingDate >= batch.from && item.tradingDate <= batch.to)
          .map(item => ({
            symbol: item.symbol,
            trading_date: item.tradingDate,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume == null ? null : Math.trunc(item.volume),
            source: 'ssi',
            observed_at: now,
            updated_at: now,
          }));

        if (!rows.length) continue;
        const { error } = await this.db.db
          .from('tce_market_ohlcv_daily')
          .upsert(rows, { onConflict: 'symbol,trading_date' });
        if (error) throw error;
        symbolRows += rows.length;
        syncedRows += rows.length;
      }

      if (symbolRows > 0) syncedSymbols += 1;
    }

    return { requested: symbols.length, syncedSymbols, syncedRows };
  }

  async dividendSymbols() {
    const { data, error } = await this.db.db
      .from('stock_events')
      .select('symbol')
      .not('symbol', 'is', null);
    if (error) throw error;
    return [...new Set((data ?? [])
      .map(row => String(row.symbol ?? '').trim().toUpperCase())
      .filter(Boolean))].sort();
  }

  private async resolveRange(symbol: string, fallbackStart: string, endDate: string) {
    const { data, error } = await this.db.db
      .from('tce_market_ohlcv_daily')
      .select('trading_date')
      .eq('symbol', symbol)
      .order('trading_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.trading_date) return { from: fallbackStart };
    const nextDate = addDays(String(data.trading_date), 1);
    return nextDate <= endDate ? { from: nextDate } : null;
  }

  private async assertDividendSymbol(symbol: string) {
    const { data, error } = await this.db.db
      .from('stock_events')
      .select('symbol')
      .eq('symbol', symbol)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.symbol) throw new Error('Dividend stock symbol not found');
  }
}

function normalizeSymbol(value: string) {
  const symbol = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new Error('Invalid stock symbol');
  return symbol;
}

function clampDays(value: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DAYS;
  return Math.min(DEFAULT_DAYS, Math.max(1, Math.trunc(parsed)));
}

function todayVietnam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return date.toISOString().slice(0, 10);
}

function monthBatches(from: string, to: string) {
  const batches: Array<{ from: string; to: string }> = [];
  let batchFrom = from;

  while (batchFrom <= to) {
    const nextMonth = addMonths(batchFrom, 1);
    const monthEnd = addDays(nextMonth, -1);
    const batchTo = monthEnd < to ? monthEnd : to;
    batches.push({ from: batchFrom, to: batchTo });
    if (batchTo === to) break;
    batchFrom = addDays(batchTo, 1);
  }

  return batches;
}
