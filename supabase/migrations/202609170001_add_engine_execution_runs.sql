begin;

create table if not exists public.tce_engine_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  workflow_id text not null default 'tce-default',
  status text not null default 'RUNNING',
  current_node text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint tce_engine_runs_status_check check (status in ('RUNNING','SUCCESS','FAILED','WAITING'))
);

create index if not exists idx_tce_engine_runs_account_started
  on public.tce_engine_runs(account_id, started_at desc);

create table if not exists public.tce_engine_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.tce_engine_runs(id) on delete cascade,
  engine_id text not null,
  sequence integer not null,
  status text not null default 'PENDING',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint tce_engine_run_steps_status_check check (status in ('PENDING','RUNNING','SUCCESS','FAILED')),
  constraint uq_tce_engine_run_steps_run_engine unique (run_id, engine_id),
  constraint uq_tce_engine_run_steps_run_sequence unique (run_id, sequence)
);

create index if not exists idx_tce_engine_run_steps_run_sequence
  on public.tce_engine_run_steps(run_id, sequence);

commit;
