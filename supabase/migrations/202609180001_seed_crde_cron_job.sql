insert into public.tce_cron_jobs (
  user_id,
  account_id,
  job_key,
  name,
  enabled,
  schedule,
  timezone,
  last_run_at
)
select
  a.user_id,
  a.id,
  'capital-rotation-decision',
  'Capital Rotation Decision',
  false,
  '*/15 * * * *',
  'Asia/Ho_Chi_Minh',
  null
from public.tce_accounts a
where not exists (
  select 1
  from public.tce_cron_jobs j
  where j.account_id = a.id
    and j.job_key = 'capital-rotation-decision'
);

comment on table public.tce_cron_jobs is
  'Runtime scheduler configuration. CRDE job is seeded disabled until demo readiness gate is passed.';


create index if not exists idx_tce_cron_jobs_account_job on public.tce_cron_jobs(account_id, job_key);
create index if not exists idx_tce_cron_runs_job_started on public.tce_cron_runs(job_id, started_at desc);
