import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SupabaseClientService } from '../db/supabase.client';

const JOB_KEY = 'capital-rotation-decision';
const STALE_RUN_MINUTES = 30;

@Injectable()
export class CapitalRotationCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CapitalRotationCronService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly db: SupabaseClientService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  onModuleDestroy() {
    for (const name of this.scheduler.getCronJobs().keys()) {
      if (name.startsWith(JOB_KEY + ':')) {
        this.scheduler.deleteCronJob(name);
      }
    }
  }

  async reload() {
    const { data, error } = await this.db.db
      .from('tce_cron_jobs')
      .select('*')
      .eq('job_key', JOB_KEY);

    if (error) {
      this.logger.warn('Unable to load CRDE cron jobs: ' + error.message);
      return;
    }

    for (const job of data ?? []) {
      await this.recoverStaleRuns(String(job.id));
      await this.reconfigure(job);
    }
  }

  async runJob(jobId: string) {
    const { data: job, error } = await this.db.db
      .from('tce_cron_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('job_key', JOB_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!job) throw new Error('CRDE cron job not found');

    return this.execute(job, true);
  }

  async status(userId: string) {
    const { data, error } = await this.db.db
      .from('tce_cron_jobs')
      .select('id,job_key,name,enabled,schedule,timezone,last_run_at')
      .eq('user_id', userId)
      .eq('job_key', JOB_KEY)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async runs(userId: string, limit = 20) {
    const job = await this.status(userId);
    if (!job) return [];
    const { data, error } = await this.db.db
      .from('tce_cron_runs')
      .select(
        'id,status,started_at,finished_at,inserted_count,updated_count,skipped_count,failed_count,error_message,metadata'
      )
      .eq('job_id', job.id)
      .order('started_at', { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 20, 1), 50));

    if (error) throw error;
    return data ?? [];
  }

  private async reconfigure(job: any) {
    const name = JOB_KEY + ':' + String(job.user_id);
    try {
      this.scheduler.deleteCronJob(name);
    } catch {
      // no-op
    }
    if (!job.enabled) return;

    const schedule = String(job.schedule || '*/15 * * * *');
    const timezone = String(job.timezone || 'Asia/Ho_Chi_Minh');
    const cron = CronJob.from({
      cronTime: schedule,
      timeZone: timezone,
      onTick: () => {
        void this.execute(job, false).catch(error => {
          this.logger.error(
            'CRDE cron failed: ' + (error instanceof Error ? error.stack : String(error))
          );
        });
      },
      start: true,
    });
    this.scheduler.addCronJob(name, cron);
  }

  private async execute(job: any, forced: boolean) {
    const jobId = String(job.id);
    if (!forced && !job.enabled) return { skipped: true, reason: 'disabled' };

    await this.recoverStaleRuns(jobId);
    if (this.running.has(jobId)) {
      return { skipped: true, reason: 'already_running' };
    }

    this.running.add(jobId);
    const startedAt = new Date().toISOString();
    let runId: string | undefined;

    try {
      const { data: run, error: runError } = await this.db.db
        .from('tce_cron_runs')
        .insert({
          job_id: jobId,
          status: 'RUNNING',
          started_at: startedAt,
          metadata: {
            engine: 'capital-rotation-decision',
            mode: 'PAPER',
            liveTradingEnabled: false,
          },
        })
        .select('id')
        .single();

      if (runError) throw runError;
      runId = String(run.id);

      // Runtime-only skeleton: orchestration is deliberately fail-closed until
      // the full decision/allocation/execution pipeline is wired in Phase 07/08.
      const outcome = {
        candidates: 0,
        decisions: 0,
        submitted: 0,
        skipped: 0,
        reason: 'crde_orchestration_not_enabled',
      };

      await this.db.db
        .from('tce_cron_runs')
        .update({
          status: 'SUCCESS',
          finished_at: new Date().toISOString(),
          inserted_count: 0,
          updated_count: 0,
          skipped_count: 1,
          failed_count: 0,
          metadata: {
            engine: 'capital-rotation-decision',
            outcome,
            liveTradingEnabled: false,
          },
        })
        .eq('id', runId);

      return { skipped: true, runId, ...outcome };
    } catch (error) {
      if (runId) {
        await this.db.db
          .from('tce_cron_runs')
          .update({
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            failed_count: 1,
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', runId);
      }
      throw error;
    } finally {
      this.running.delete(jobId);
    }
  }

  private async recoverStaleRuns(jobId: string) {
    const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString();
    const { error } = await this.db.db
      .from('tce_cron_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        error_message: 'Recovered stale CRDE RUNNING run after service restart',
      })
      .eq('job_id', jobId)
      .eq('status', 'RUNNING')
      .lt('started_at', cutoff);

    if (error) {
      this.logger.warn('Unable to recover stale CRDE runs: ' + error.message);
    }
  }
}
