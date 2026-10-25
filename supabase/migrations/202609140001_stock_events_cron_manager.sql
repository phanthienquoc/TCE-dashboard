begin;

alter table public.stock_events
  add column if not exists sync_status text not null default 'PENDING',
  add column if not exists sync_hash text,
  add column if not exists sync_attempts integer not null default 0,
  add column if not exists sync_error text;

update public.stock_events
set sync_status = case when synced_at is not null then 'SYNCED' else 'PENDING' end
where sync_status is null or sync_status = '';

alter table public.stock_events
  drop constraint if exists stock_events_sync_status_check;

alter table public.stock_events
  add constraint stock_events_sync_status_check
    check (sync_status in ('PENDING', 'SYNCED', 'FAILED'));

create index if not exists idx_stock_events_sync_queue
  on public.stock_events(sync_status, gdkhq_timestamp, updated_at desc);

create table if not exists public.tce_cron_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  job_key text not null,
  name text not null,
  enabled boolean not null default false,
  schedule text not null default '*/15 * * * *',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  sync_start_date date,
  sync_end_date date,
  batch_size integer not null default 200,
  price_sync_enabled boolean not null default true,
  telegram_credential_id uuid references public.platform_credentials(id) on delete set null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, job_key),
  constraint tce_cron_jobs_batch_size_check check (batch_size between 50 and 500),
  constraint tce_cron_jobs_window_check check (
    sync_start_date is null or sync_end_date is null or sync_start_date <= sync_end_date
  )
);

create index if not exists idx_tce_cron_jobs_active
  on public.tce_cron_jobs(enabled, job_key);

create table if not exists public.tce_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.tce_cron_jobs(id) on delete cascade,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  symbols_requested integer not null default 0,
  symbols_synced integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint tce_cron_runs_status_check check (status in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED'))
);

create index if not exists idx_tce_cron_runs_job_started
  on public.tce_cron_runs(job_id, started_at desc);

alter table public.tce_cron_jobs enable row level security;
alter table public.tce_cron_runs enable row level security;

commit;
