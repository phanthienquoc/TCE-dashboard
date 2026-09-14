begin;

-- Clear orphaned runs left behind by the pre-lock implementation. This is a
-- one-time deployment cleanup; future runs are protected by the unique index.
update public.tce_cron_runs
set status = 'FAILED',
    finished_at = coalesce(finished_at, now()),
    error_message = coalesce(error_message, 'Cleared orphaned RUNNING run during cron lock migration')
where status = 'RUNNING';

-- A job may have only one active run at a time, across all service replicas.
create unique index if not exists uq_tce_cron_runs_one_running
  on public.tce_cron_runs(job_id)
  where status = 'RUNNING';

commit;
