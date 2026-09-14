begin;

update public.tce_cron_runs
set status = 'FAILED',
    finished_at = coalesce(finished_at, now()),
    error_message = coalesce(error_message, 'Recovered stale RUNNING run after service restart')
where status = 'RUNNING'
  and started_at < now() - interval '30 minutes';

create unique index if not exists uq_tce_cron_runs_one_running
  on public.tce_cron_runs(job_id)
  where status = 'RUNNING';

commit;
