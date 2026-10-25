begin;

alter table public.tce_cron_jobs
  alter column schedule set default '0 */4 * * *';

-- Migrate only the old built-in default; preserve schedules explicitly customized by users.
update public.tce_cron_jobs
set schedule = '0 */4 * * *',
    updated_at = now()
where job_key = 'stock-events-sync'
  and schedule = '*/15 * * * *';

commit;
