import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SupabaseClientService } from '../db/supabase.client';
import { StockEventsSyncResult, StockEventsSyncService } from './stock-events-sync.service';
import { DividendOhlcvService } from './dividend-ohlcv.service';

export type StockEventsCronConfig = {
  enabled: boolean;
  schedule: string;
  timezone: string;
  syncStartDate: string | null;
  syncEndDate: string | null;
  batchSize: number;
  pageSize: number;
  priceSyncEnabled: boolean;
  telegramCredentialId: string | null;
  lastRunAt: string | null;
};

const JOB_KEY = 'stock-events-sync';
const STALE_RUN_MINUTES = 30;
const DEFAULT_FUTURE_SYNC_DAYS = 365;
const DEFAULT_PAGE_SIZE = 10;
type TriggerResponse = { status: 'RUNNING'; alreadyRunning: boolean };

@Injectable()
export class StockEventsCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockEventsCronService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly db: SupabaseClientService,
    private readonly scheduler: SchedulerRegistry,
    private readonly sync: StockEventsSyncService,
    private readonly dividendOhlcv: DividendOhlcvService
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  onModuleDestroy() {
    for (const name of this.scheduler.getCronJobs().keys()) {
      if (name.startsWith(`${JOB_KEY}:`)) this.scheduler.deleteCronJob(name);
    }
  }

  async getConfig(userId: string): Promise<StockEventsCronConfig> {
    const job = await this.ensureConfig(userId);
    return this.mapConfig(job);
  }

  async saveConfig(userId: string, input: Partial<StockEventsCronConfig>) {
    const existing = await this.ensureConfig(userId);
    const schedule = String(input.schedule ?? existing.schedule ?? '0 */4 * * *').trim();
    const timezone = String(input.timezone ?? existing.timezone ?? 'Asia/Ho_Chi_Minh').trim();
    const start = normalizeDate(input.syncStartDate ?? existing.sync_start_date);
    const end = normalizeDate(input.syncEndDate ?? existing.sync_end_date);
    if (start && end && start > end)
      throw new Error('Sync start date must be before or equal to end date');
    validateCronExpression(schedule, timezone);
    const batchSize = Math.min(
      Math.max(Math.trunc(Number(input.batchSize ?? existing.batch_size ?? 200)), 50),
      500
    );
    const pageSize = Math.min(
      Math.max(Math.trunc(Number(input.pageSize ?? existing.page_size ?? DEFAULT_PAGE_SIZE)), 1),
      100
    );
    const payload = {
      enabled: input.enabled === undefined ? Boolean(existing.enabled) : input.enabled === true,
      schedule,
      timezone,
      sync_start_date: start,
      sync_end_date: end,
      batch_size: batchSize,
      page_size: pageSize,
      price_sync_enabled:
        input.priceSyncEnabled === undefined
          ? Boolean(existing.price_sync_enabled)
          : input.priceSyncEnabled !== false,
      telegram_credential_id:
        input.telegramCredentialId === undefined
          ? (existing.telegram_credential_id ?? null)
          : input.telegramCredentialId || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.db.db
      .from('tce_cron_jobs')
      .update(payload)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    await this.reconfigure(data);
    return this.mapConfig(data);
  }

  async trigger(userId: string): Promise<TriggerResponse> {
    const job = await this.ensureConfig(userId);
    const jobId = String(job.id);
    await this.recoverStaleRuns(jobId);
    if (this.running.has(jobId)) return { status: 'RUNNING', alreadyRunning: true };

    const { data: activeRun, error } = await this.db.db
      .from('tce_cron_runs')
      .select('id')
      .eq('job_id', jobId)
      .eq('status', 'RUNNING')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (activeRun) return { status: 'RUNNING', alreadyRunning: true };

    void this.execute(job, true).catch(error => {
      this.logger.error(
        `Stock event manual trigger ${jobId} failed`,
        error instanceof Error ? error.stack : String(error)
      );
    });
    return { status: 'RUNNING', alreadyRunning: false };
  }

  async runs(userId: string, limit = 20) {
    const job = await this.ensureConfig(userId);
    await this.recoverStaleRuns(String(job.id));
    const { data, error } = await this.db.db
      .from('tce_cron_runs')
      .select(
        'id,status,started_at,finished_at,inserted_count,updated_count,skipped_count,failed_count,symbols_requested,symbols_synced,error_message,metadata'
      )
      .eq('job_id', job.id)
      .order('started_at', { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 20, 1), 50));
    if (error) throw error;
    return data ?? [];
  }

  private async reload() {
    const { data, error } = await this.db.db
      .from('tce_cron_jobs')
      .select('*')
      .eq('job_key', JOB_KEY);
    if (error) {
      this.logger.warn(`Unable to load stock events cron jobs: ${error.message}`);
      return;
    }
    for (const job of data ?? []) {
      await this.recoverStaleRuns(String(job.id));
      await this.reconfigure(job);
    }
  }

  private async ensureConfig(userId: string) {
    const { data: account, error: accountError } = await this.db.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account?.id) throw new Error('TCE account is not configured');
    const { data, error } = await this.db.db
      .from('tce_cron_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('job_key', JOB_KEY)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: created, error: createError } = await this.db.db
      .from('tce_cron_jobs')
      .insert({
        user_id: userId,
        account_id: account.id,
        job_key: JOB_KEY,
        name: 'Stock Events Sync',
        enabled: false,
        schedule: '0 */4 * * *',
        timezone: 'Asia/Ho_Chi_Minh',
        sync_start_date: null,
        sync_end_date: null,
        batch_size: 200,
        page_size: DEFAULT_PAGE_SIZE,
        price_sync_enabled: true,
      })
      .select('*')
      .single();
    if (createError) throw createError;
    return created;
  }

  private jobName(job: any) {
    return `${JOB_KEY}:${String(job.user_id)}`;
  }

  private async reconfigure(job: any) {
    const jobName = this.jobName(job);
    try {
      this.scheduler.deleteCronJob(jobName);
    } catch {
      /* no-op */
    }
    if (!job.enabled) return;
    validateCronExpression(String(job.schedule), String(job.timezone));
    const cron = CronJob.from({
      cronTime: String(job.schedule),
      timeZone: String(job.timezone),
      onTick: () => {
        void this.execute(job, false).catch(error => {
          this.logger.error(
            `Stock event cron ${jobName} failed`,
            error instanceof Error ? error.stack : String(error)
          );
        });
      },
      start: true,
    });
    this.scheduler.addCronJob(jobName, cron);
  }

  private async execute(job: any, forced: boolean) {
    const jobId = String(job.id);
    if (!forced && !job.enabled) return {} as StockEventsSyncResult;
    await this.recoverStaleRuns(jobId);
    if (this.running.has(jobId)) throw new Error('Stock events sync is already running');
    this.running.add(jobId);
    try {
      const startDate = job.sync_start_date ?? todayVietnam();
      const endDate = job.sync_end_date ?? addDays(startDate, DEFAULT_FUTURE_SYNC_DAYS);
      const result = await this.sync.run({
        userId: String(job.user_id),
        jobId,
        syncStartDate: startDate,
        syncEndDate: endDate,
        batchSize: Number(job.batch_size ?? 200),
        pageSize: Number(job.page_size ?? DEFAULT_PAGE_SIZE),
        priceSyncEnabled: Boolean(job.price_sync_enabled),
        telegramCredentialId: job.telegram_credential_id,
      });

      // Strict pipeline: Vietstock page crawl/upsert must finish before
      // selecting dividend symbols and fetching their daily OHLCV/K-line data.
      // This prevents the K-line phase from racing the stock-event page sync.
      try {
        const klineResult = await this.dividendOhlcv.syncDividendSymbols(
          String(job.user_id),
          'production',
          startDate,
          endDate
        );
        this.logger.log(
          `Dividend K-line sync completed after Vietstock sync: run=${klineResult.runId}, requested=${klineResult.requested}, synced=${klineResult.syncedSymbols}, failed=${klineResult.failedSymbols}`
        );
      } catch (error) {
        this.logger.error(
          `Dividend K-line sync failed after Vietstock sync: ${error instanceof Error ? error.stack : String(error)}`
        );
        throw error;
      }

      await this.db.db
        .from('tce_cron_jobs')
        .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', jobId);
      return result;
    } finally {
      this.running.delete(jobId);
    }
  }

  private async recoverStaleRuns(jobId: string) {
    const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
    const { data, error } = await this.db.db
      .from('tce_cron_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        error_message: 'Recovered stale RUNNING run after service restart',
      })
      .eq('job_id', jobId)
      .eq('status', 'RUNNING')
      .lt('started_at', cutoff)
      .select('id');
    if (error) {
      this.logger.warn(`Unable to recover stale stock event runs: ${error.message}`);
      return;
    }
    if (data?.length)
      this.logger.warn(`Recovered ${data.length} stale stock event run(s) for job ${jobId}`);
  }

  private mapConfig(job: any): StockEventsCronConfig {
    return {
      enabled: Boolean(job.enabled),
      schedule: String(job.schedule),
      timezone: String(job.timezone),
      syncStartDate: job.sync_start_date ?? null,
      syncEndDate: job.sync_end_date ?? null,
      batchSize: Number(job.batch_size ?? 200),
      pageSize: Number(job.page_size ?? DEFAULT_PAGE_SIZE),
      priceSyncEnabled: Boolean(job.price_sync_enabled),
      telegramCredentialId: job.telegram_credential_id ?? null,
      lastRunAt: job.last_run_at ?? null,
    };
  }
}

function normalizeDate(value?: string | null) {
  if (value == null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error('Date must use YYYY-MM-DD');
  return String(value);
}

function todayVietnam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
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

function validateCronExpression(expression: string, timeZone: string) {
  if (!expression || expression.split(/\s+/).length !== 5)
    throw new Error('Cron schedule must use 5 fields');
  if (!timeZone.includes('/')) throw new Error('Invalid timezone');
  CronJob.from({ cronTime: expression, timeZone, onTick: () => undefined });
}
