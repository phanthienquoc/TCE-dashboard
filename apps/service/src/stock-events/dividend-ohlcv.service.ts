import { Injectable } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiApplicationService } from '../platform/ssi.application.service';

const DEFAULT_DAYS = 365;
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const OHLCV_BATCH_TIMEOUT_MS = 75_000;
const OHLCV_SYMBOL_CONCURRENCY = 5;

export type DividendOhlcvSyncItem = {
  symbol: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  phase:
    'QUEUED' | 'RESOLVING_RANGE' | 'FETCHING' | 'UPSERTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  batchIndex: number | null;
  batchTotal: number | null;
  batchFrom: string | null;
  batchTo: string | null;
  rowsSynced: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

@Injectable()
export class DividendOhlcvService {
  constructor(
    private readonly db: SupabaseClientService,
    private readonly ssi: SsiApplicationService
  ) {}

  async getHistory(symbolInput: string, days = DEFAULT_DAYS) {
    const symbol = normalizeSymbol(symbolInput);
    await this.assertDividendSymbol(symbol);
    const rangeDays = clampDays(days);
    const from =
      rangeDays === DEFAULT_DAYS
        ? oneYearWindowStart(todayVietnam())
        : addDays(todayVietnam(), -(rangeDays - 1));
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

  async syncDividendSymbols(
    userId: string,
    environment = 'production',
    fromDate?: string,
    toDate?: string
  ) {
    const symbols = await this.dividendSymbols();
    const endDate = toDate ?? todayVietnam();
    const fallbackStart = fromDate ?? oneYearWindowStart(endDate);
    const runId = await this.createSyncRun(userId, symbols);
    let syncedSymbols = 0;
    let syncedRows = 0;
    let failedSymbols = 0;

    try {
      await runWithConcurrency(symbols, OHLCV_SYMBOL_CONCURRENCY, async symbol => {
        const itemId = await this.createSyncItem(runId, symbol);
        const startedAt = new Date().toISOString();
        await this.updateSyncItem(itemId, {
          status: 'RUNNING',
          phase: 'RESOLVING_RANGE',
          started_at: startedAt,
          updated_at: startedAt,
        });
        await this.updateSyncRun(runId, {
          current_symbol: symbol,
          current_phase: 'RESOLVING_RANGE',
          current_batch_index: null,
          current_batch_total: null,
          current_batch_from: null,
          current_batch_to: null,
          current_rows_synced: 0,
        });

        try {
          const range = await this.resolveRange(symbol, fallbackStart, endDate);
          if (!range) {
            const finishedAt = new Date().toISOString();
            await this.updateSyncItem(itemId, {
              status: 'SUCCEEDED',
              phase: 'COMPLETED',
              finished_at: finishedAt,
              updated_at: finishedAt,
            });
            syncedSymbols += 1;
            await this.updateSyncRun(runId, {
              symbols_synced: syncedSymbols,
              rows_synced: syncedRows,
              current_symbol: null,
              current_phase: null,
              current_batch_index: null,
              current_batch_total: null,
              current_batch_from: null,
              current_batch_to: null,
              current_rows_synced: 0,
            });
            return;
          }

          const batches = monthBatches(range.from, endDate);
          let symbolRows = 0;
          for (let index = 0; index < batches.length; index += 1) {
            const batch = batches[index];
            const batchIndex = index + 1;
            await this.updateSyncItem(itemId, {
              phase: 'FETCHING',
              batch_index: batchIndex,
              batch_total: batches.length,
              batch_from: batch.from,
              batch_to: batch.to,
              rows_synced: symbolRows,
            });
            await this.updateSyncRun(runId, {
              current_symbol: symbol,
              current_phase: 'FETCHING',
              current_batch_index: batchIndex,
              current_batch_total: batches.length,
              current_batch_from: batch.from,
              current_batch_to: batch.to,
              current_rows_synced: symbolRows,
            });

            const result = await withTimeout(
              this.ssi.dailyOhlcv(userId, environment, [symbol], batch.from, batch.to),
              OHLCV_BATCH_TIMEOUT_MS,
              `${symbol} ${batch.from} -> ${batch.to}`
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
            await this.updateSyncItem(itemId, { phase: 'UPSERTING', rows_synced: symbolRows });
            await this.updateSyncRun(runId, {
              current_symbol: symbol,
              current_phase: 'UPSERTING',
              current_batch_index: batchIndex,
              current_batch_total: batches.length,
              current_batch_from: batch.from,
              current_batch_to: batch.to,
              current_rows_synced: symbolRows,
            });

            const { error } = await this.db.db
              .from('tce_market_ohlcv_daily')
              .upsert(rows, { onConflict: 'symbol,trading_date' });
            if (error) throw error;
            symbolRows += rows.length;
            syncedRows += rows.length;
            await this.updateSyncItem(itemId, { phase: 'FETCHING', rows_synced: symbolRows });
            await this.updateSyncRun(runId, { current_rows_synced: symbolRows });
          }

          const finishedAt = new Date().toISOString();
          await this.updateSyncItem(itemId, {
            status: 'SUCCEEDED',
            phase: 'COMPLETED',
            rows_synced: symbolRows,
            finished_at: finishedAt,
            updated_at: finishedAt,
          });
          syncedSymbols += 1;
          await this.updateSyncRun(runId, {
            symbols_synced: syncedSymbols,
            rows_synced: syncedRows,
            current_symbol: null,
            current_phase: null,
            current_batch_index: null,
            current_batch_total: null,
            current_batch_from: null,
            current_batch_to: null,
            current_rows_synced: 0,
          });
        } catch (error) {
          failedSymbols += 1;
          const message = error instanceof Error ? error.message : String(error);
          const finishedAt = new Date().toISOString();
          await this.updateSyncItem(itemId, {
            status: 'FAILED',
            phase: 'FAILED',
            error_message: message,
            finished_at: finishedAt,
            updated_at: finishedAt,
          });
          await this.updateSyncRun(runId, {
            current_symbol: null,
            current_phase: null,
            current_batch_index: null,
            current_batch_total: null,
            current_batch_from: null,
            current_batch_to: null,
            current_rows_synced: 0,
            rows_synced: syncedRows,
          });
        }
      });

      await this.finishSyncRun(runId, {
        status: failedSymbols > 0 ? (syncedSymbols > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCEEDED',
        symbols_synced: syncedSymbols,
        rows_synced: syncedRows,
        error_message: failedSymbols > 0 ? `${failedSymbols} stock sync item(s) failed` : null,
      });
      return { runId, requested: symbols.length, syncedSymbols, syncedRows, failedSymbols };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishSyncRun(runId, {
        status: 'FAILED',
        symbols_synced: syncedSymbols,
        rows_synced: syncedRows,
        error_message: message,
      });
      throw error;
    }
  }

  async latestSyncProgress(userId: string) {
    const { data: run, error: runError } = await this.db.db
      .from('tce_dividend_ohlcv_sync_runs')
      .select(
        'id,status,started_at,finished_at,symbols_requested,symbols_synced,rows_synced,error_message,current_symbol,current_phase,current_batch_index,current_batch_total,current_batch_from,current_batch_to,current_rows_synced,updated_at'
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) return null;

    const { data: items, error: itemError } = await this.db.db
      .from('tce_dividend_ohlcv_sync_items')
      .select(
        'id,symbol,status,phase,batch_index,batch_total,batch_from,batch_to,rows_synced,error_message,started_at,finished_at,updated_at'
      )
      .eq('run_id', run.id)
      .order('symbol', { ascending: true });
    if (itemError) throw itemError;
    return { ...run, items: items ?? [] };
  }

  async dividendSymbols() {
    const today = todayVietnam();
    const { data, error } = await this.db.db
      .from('stock_events')
      .select('symbol,ex_right_date')
      .not('symbol', 'is', null)
      .gte('ex_right_date', today)
      .order('ex_right_date', { ascending: true })
      .order('symbol', { ascending: true });
    if (error) throw error;
    return [
      ...new Set(
        (data ?? [])
          .map(row =>
            String(row.symbol ?? '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      ),
    ];
  }

  private async createSyncRun(userId: string, symbols: string[]) {
    const { data, error } = await this.db.db
      .from('tce_dividend_ohlcv_sync_runs')
      .insert({
        user_id: userId,
        symbols_requested: symbols.length,
        status: 'RUNNING',
        current_symbol: symbols[0] ?? null,
        current_phase: symbols.length ? 'QUEUED' : null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return String(data.id);
  }

  private async createSyncItem(runId: string, symbol: string) {
    const { data, error } = await this.db.db
      .from('tce_dividend_ohlcv_sync_items')
      .insert({ run_id: runId, symbol })
      .select('id')
      .single();
    if (error) throw error;
    return String(data.id);
  }

  private async updateSyncItem(id: string, patch: Record<string, unknown>) {
    const { error } = await this.db.db
      .from('tce_dividend_ohlcv_sync_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  private async updateSyncRun(id: string, patch: Record<string, unknown>) {
    const { error } = await this.db.db
      .from('tce_dividend_ohlcv_sync_runs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  private async finishSyncRun(id: string, patch: Record<string, unknown>) {
    await this.updateSyncRun(id, {
      ...patch,
      finished_at: new Date().toISOString(),
      current_symbol: null,
      current_phase: null,
      current_batch_index: null,
      current_batch_total: null,
      current_batch_from: null,
      current_batch_to: null,
      current_rows_synced: 0,
    });
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

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

function normalizeSymbol(value: string) {
  const symbol = String(value ?? '')
    .trim()
    .toUpperCase();
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

function oneYearWindowStart(endDate: string) {
  const end = new Date(`${endDate}T00:00:00Z`);
  return `${end.getUTCFullYear() - 1}-01-01`;
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`SSI OHLCV batch timeout after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
