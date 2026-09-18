insert into public.tce_cron_jobs (
  user_id,
  account_id,
  job_key,
  name,
  enabled,
  schedule,
  timezone,
  last_run_at,
  metadata
)
select
  a.user_id,
  a.id,
  'capital-rotation-decision',
  'Capital Rotation Decision',
  false,
  '*/15 * * * *',
  'Asia/Ho_Chi_Minh',
  null,
  jsonb_build_object(
    'engine_id', 'capital-rotation-decision',
    'mode', 'PAPER',
    'live_trading_enabled', false,
    'purpose', 'CRDE runtime/observability bootstrap'
  )
from public.tce_accounts a
where not exists (
  select 1
  from public.tce_cron_jobs j
  where j.account_id = a.id
    and j.job_key = 'capital-rotation-decision'
);

alter table public.tce_cron_jobs
  drop constraint if exists tce_cron_jobs_job_key_check;

alter table public.tce_cron_jobs
  add constraint tce_cron_jobs_job_key_check
  check (
    job_key in (
      'stock-events-sync',
      'capital-rotation-decision'
    )
  );
