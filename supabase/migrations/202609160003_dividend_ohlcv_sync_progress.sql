begin;

create table if not exists public.tce_dividend_ohlcv_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'RUNNING',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  symbols_requested integer not null default 0,
  symbols_synced integer not null default 0,
  rows_synced integer not null default 0,
  error_message text,
  current_symbol text,
  current_phase text,
  current_batch_index integer,
  current_batch_total integer,
  current_batch_from date,
  current_batch_to date,
  current_rows_synced integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint tce_dividend_ohlcv_sync_runs_status_check check (status in ('RUNNING','SUCCEEDED','PARTIAL','FAILED'))
);

create index if not exists idx_tce_dividend_ohlcv_sync_runs_user_started
  on public.tce_dividend_ohlcv_sync_runs(user_id, started_at desc);

alter table public.tce_dividend_ohlcv_sync_runs enable row level security;

create table if not exists public.tce_dividend_ohlcv_sync_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.tce_dividend_ohlcv_sync_runs(id) on delete cascade,
  symbol text not null,
  status text not null default 'QUEUED',
  phase text not null default 'QUEUED',
  batch_index integer,
  batch_total integer,
  batch_from date,
  batch_to date,
  rows_synced integer not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(run_id, symbol),
  constraint tce_dividend_ohlcv_sync_items_status_check check (status in ('QUEUED','RUNNING','SUCCEEDED','FAILED','SKIPPED')),
  constraint tce_dividend_ohlcv_sync_items_phase_check check (phase in ('QUEUED','RESOLVING_RANGE','FETCHING','UPSERTING','COMPLETED','FAILED','SKIPPED'))
);

create index if not exists idx_tce_dividend_ohlcv_sync_items_run
  on public.tce_dividend_ohlcv_sync_items(run_id, symbol);

alter table public.tce_dividend_ohlcv_sync_items enable row level security;

commit;
