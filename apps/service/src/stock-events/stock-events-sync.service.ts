import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseClientService } from '../db/supabase.client';
import { SsiMarketPriceService } from '../platform/ssi-market-price.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CrawledStockEvent, VietstockEventsCrawler } from './vietstock-events.crawler';

export type StockEventsSyncOptions = {
  userId: string;
  jobId: string;
  syncStartDate?: string | null;
  syncEndDate?: string | null;
  batchSize?: number;
  priceSyncEnabled?: boolean;
  telegramCredentialId?: string | null;
};

export type StockEventsSyncResult = {
  runId: string;
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  symbolsRequested: number;
  symbolsSynced: number;
};

@Injectable()
export class StockEventsSyncService {
  private readonly logger = new Logger(StockEventsSyncService.name);

  constructor(
    private readonly db: SupabaseClientService,
    private readonly crawler: VietstockEventsCrawler,
    private readonly ssiPrices: SsiMarketPriceService,
    private readonly telegram: TelegramBotService,
  ) {}

  async run(options: StockEventsSyncOptions): Promise<StockEventsSyncResult> {
    const batchSize = Math.min(Math.max(Math.trunc(options.batchSize ?? 200), 50), 500);
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await this.db.db
      .from('tce_cron_runs')
      .insert({ job_id: options.jobId, status: 'RUNNING', started_at: startedAt })
      .select('id')
      .single();
    if (runError) throw runError;

    try {
      const events = await this.crawler.crawl({ startDate: options.syncStartDate, endDate: options.syncEndDate });
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      let eventError: string | null = null;

      for (let offset = 0; offset < events.length; offset += batchSize) {
        const batch = events.slice(offset, offset + batchSize);
        const existing = await this.loadExisting(batch.map(event => event.mongoId));
        const upserts: Record<string, unknown>[] = [];
        for (const event of batch) {
          const hash = eventHash(event);
          const current = existing.get(event.mongoId);
          if (current?.sync_status === 'SYNCED' && current.sync_hash === hash) {
            skipped += 1;
            continue;
          }
          upserts.push({
            mongo_id: event.mongoId,
            symbol: event.symbol,
            exchange: event.exchange,
            ex_right_date: event.exRightDate,
            record_date: event.recordDate,
            payment_date: event.paymentDate,
            event_content: event.eventContent,
            ratio_text: event.ratioText,
            dividend_value: event.dividendValue,
            reference_price: event.referencePrice,
            gdkhq_timestamp: event.gdkhqTimestamp,
            crawled_at: event.crawledAt,
            sync_status: 'SYNCED',
            sync_hash: hash,
            sync_attempts: Number(current?.sync_attempts ?? 0) + 1,
            sync_error: null,
            synced_at: new Date().toISOString(),
            raw_data: event.rawData,
            updated_at: new Date().toISOString(),
          });
          if (current) updated += 1;
          else inserted += 1;
        }
        if (!upserts.length) continue;
        const { error } = await this.db.db.from('stock_events').upsert(upserts, { onConflict: 'mongo_id' });
        if (error) {
          failed += upserts.length;
          eventError = error.message;
          this.logger.error(`Stock event batch failed: ${error.message}`);
          await this.markBatchFailed(upserts, error.message);
          inserted -= upserts.filter(row => !existing.has(String(row.mongo_id))).length;
          updated -= upserts.filter(row => existing.has(String(row.mongo_id))).length;
        }
      }

      let symbolsRequested = 0;
      let symbolsSynced = 0;
      if (options.priceSyncEnabled !== false) {
        const symbols = [...new Set(events.map(event => event.symbol).filter(Boolean))].sort();
        symbolsRequested = symbols.length;
        if (symbols.length) {
          try {
            const priceResult = await this.ssiPrices.syncSymbolsNow(options.userId, symbols, batchSize);
            symbolsSynced = priceResult.data.symbolsSynced;
            if (!priceResult.ok) failed += priceResult.errors.length || Math.max(symbolsRequested - symbolsSynced, 0);
          } catch (error) {
            failed += Math.max(symbolsRequested - symbolsSynced, 1);
            eventError = error instanceof Error ? error.message : String(error);
            this.logger.error(`SSI price sync failed: ${eventError}`);
          }
        }
      }

      const status = failed > 0 ? (inserted + updated + skipped > 0 ? 'PARTIAL' : 'FAILED') : 'SUCCEEDED';
      await this.finishRun(String(run.id), { status, inserted, updated, skipped, failed, symbolsRequested, symbolsSynced, errorMessage: eventError });
      const result = { runId: String(run.id), status, inserted, updated, skipped, failed, symbolsRequested, symbolsSynced } satisfies StockEventsSyncResult;
      await this.notify(options, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.finishRun(String(run.id), { status: 'FAILED', inserted: 0, updated: 0, skipped: 0, failed: 1, symbolsRequested: 0, symbolsSynced: 0, errorMessage: message });
      await this.notify(options, { runId: String(run.id), status: 'FAILED', inserted: 0, updated: 0, skipped: 0, failed: 1, symbolsRequested: 0, symbolsSynced: 0 });
      throw error;
    }
  }

  private async loadExisting(mongoIds: string[]) {
    const map = new Map<string, { sync_status: string; sync_hash: string | null; sync_attempts: number }>();
    for (let offset = 0; offset < mongoIds.length; offset += 200) {
      const ids = mongoIds.slice(offset, offset + 200);
      if (!ids.length) continue;
      const { data, error } = await this.db.db.from('stock_events').select('mongo_id,sync_status,sync_hash,sync_attempts').in('mongo_id', ids);
      if (error) throw error;
      for (const row of data ?? []) map.set(String(row.mongo_id), { sync_status: String(row.sync_status ?? 'PENDING'), sync_hash: row.sync_hash == null ? null : String(row.sync_hash), sync_attempts: Number(row.sync_attempts ?? 0) });
    }
    return map;
  }

  private async markBatchFailed(rows: Record<string, unknown>[], message: string) {
    const ids = rows.map(row => String(row.mongo_id));
    await this.db.db.from('stock_events').update({ sync_status: 'FAILED', sync_error: message, updated_at: new Date().toISOString() }).in('mongo_id', ids);
  }

  private async finishRun(runId: string, result: Partial<StockEventsSyncResult> & { errorMessage?: string | null }) {
    await this.db.db.from('tce_cron_runs').update({
      status: result.status,
      finished_at: new Date().toISOString(),
      inserted_count: result.inserted ?? 0,
      updated_count: result.updated ?? 0,
      skipped_count: result.skipped ?? 0,
      failed_count: result.failed ?? 0,
      symbols_requested: result.symbolsRequested ?? 0,
      symbols_synced: result.symbolsSynced ?? 0,
      error_message: result.errorMessage ?? null,
      metadata: { sync: 'vietstock-events', priceSource: 'ssi' },
    }).eq('id', runId);
  }

  private async notify(options: StockEventsSyncOptions, result: StockEventsSyncResult) {
    if (!options.telegramCredentialId) return;
    const message = [
      'TCE Stock Events Sync',
      `Status: ${result.status}`,
      `Inserted: ${result.inserted}`,
      `Updated: ${result.updated}`,
      `Skipped: ${result.skipped}`,
      `Failed: ${result.failed}`,
      `SSI prices: ${result.symbolsSynced}/${result.symbolsRequested}`,
    ].join('\n');
    try {
      await this.telegram.sendToCredential(options.userId, options.telegramCredentialId, message);
    } catch (error) {
      this.logger.warn(`Telegram sync notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function eventHash(event: CrawledStockEvent) {
  const payload = {
    symbol: event.symbol,
    exchange: event.exchange,
    exRightDate: event.exRightDate,
    recordDate: event.recordDate,
    paymentDate: event.paymentDate,
    eventContent: event.eventContent,
    ratioText: event.ratioText,
    dividendValue: event.dividendValue,
    referencePrice: event.referencePrice,
    gdkhqTimestamp: event.gdkhqTimestamp,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
