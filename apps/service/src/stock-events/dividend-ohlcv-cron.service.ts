import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SupabaseClientService } from '../db/supabase.client';
import { DividendOhlcvService } from './dividend-ohlcv.service';

const JOB_NAME = 'dividend-ohlcv-sync';
const DEFAULT_SCHEDULE = '30 16 * * 1-5';
const TIMEZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class DividendOhlcvCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DividendOhlcvCronService.name);
  private running = false;

  constructor(
    private readonly scheduler: SchedulerRegistry,
    private readonly db: SupabaseClientService,
    private readonly service: DividendOhlcvService
  ) {}

  async onModuleInit() {
    this.scheduler.addCronJob(
      JOB_NAME,
      CronJob.from({
        cronTime: DEFAULT_SCHEDULE,
        timeZone: TIMEZONE,
        onTick: () => void this.runAll().catch(error => this.logger.error(String(error))),
        start: true,
      })
    );
  }

  onModuleDestroy() {
    try {
      this.scheduler.deleteCronJob(JOB_NAME);
    } catch {
      // no-op
    }
  }

  private async runAll() {
    if (this.running) return;
    this.running = true;
    try {
      const { data, error } = await this.db.db
        .from('tce_accounts')
        .select('user_id')
        .not('user_id', 'is', null);
      if (error) throw error;
      for (const row of data ?? []) {
        const userId = String(row.user_id ?? '').trim();
        if (!userId) continue;
        try {
          await this.service.syncDividendSymbols(userId);
        } catch (error) {
          this.logger.error(`Dividend OHLCV sync failed for ${userId}: ${String(error)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
