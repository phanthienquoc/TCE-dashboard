create table if not exists public.tce_reconciliation_events (
  event_id text primary key,
  run_id text not null,
  account_id text not null,
  environment text not null check (environment in ('PAPER', 'LIVE')),
  correlation_id text not null,
  event_type text not null,
  observed_at timestamptz not null,
  disposition text not null,
  local_order_id text,
  provider_order_id text,
  provider_state text,
  provider_status text,
  local_status text,
  local_filled_quantity numeric,
  provider_filled_quantity numeric,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tce_reconciliation_events_run
  on public.tce_reconciliation_events(account_id, environment, run_id);

create index if not exists idx_tce_reconciliation_events_observed
  on public.tce_reconciliation_events(account_id, environment, observed_at desc);
