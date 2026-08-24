create extension if not exists pgcrypto;

create table if not exists public.tce_strategy_config (
  account_id uuid primary key references public.tce_accounts(id) on delete cascade,
  max_positions integer not null default 2 check (max_positions between 1 and 20),
  pool_size integer not null default 5 check (pool_size between 1 and 50),
  core_capital bigint not null default 15000000 check (core_capital >= 0),
  burst_capital bigint not null default 5000000 check (burst_capital >= 0),
  monitor_interval_minutes integer not null default 60 check (monitor_interval_minutes >= 15),
  timezone text not null default 'Asia/Ho_Chi_Minh', market_open time not null default '09:00', market_close time not null default '14:45', updated_at timestamptz not null default now()
);

create table if not exists public.tce_pool_entries (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.tce_accounts(id) on delete cascade, symbol text not null, rank integer not null check (rank > 0),
  status text not null default 'WATCHING' check (status in ('WATCHING','TRIGGERED','POSITIONED','REJECTED','EXPIRED','REMOVED')), score numeric(8,3), cashout_score numeric(8,3), liquidity_score numeric(8,3), catalyst_score numeric(8,3), recovery_score numeric(8,3), risk_score numeric(8,3),
  entry_low numeric(18,4), entry_high numeric(18,4), target_price numeric(18,4), invalidation_price numeric(18,4), expected_cashout bigint, expected_return_pct numeric(10,4), expected_hold_days integer,
  rationale jsonb not null default '{}'::jsonb, observed_at timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(account_id, symbol, observed_at)
);
create index if not exists idx_tce_pool_active on public.tce_pool_entries(account_id, status, rank) where status in ('WATCHING','TRIGGERED','POSITIONED');

create table if not exists public.tce_position_snapshots (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.tce_accounts(id) on delete cascade, symbol text not null, observed_at timestamptz not null default now(),
  market_price numeric(18,4), quantity integer not null default 0 check (quantity >= 0), avg_cost numeric(18,4), market_value bigint, cost_basis bigint, unrealized_pnl bigint, unrealized_pnl_pct numeric(10,4), volume bigint, turnover bigint,
  signal text not null default 'HOLD' check (signal in ('HOLD','WATCH','TAKE_PROFIT','CUT','CASHOUT','EXIT')), signal_score numeric(8,3), signal_reason jsonb not null default '{}'::jsonb, t_plus integer not null default 2 check (t_plus between 0 and 3), is_market_hours boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists idx_tce_position_snapshots_lookup on public.tce_position_snapshots(account_id, symbol, observed_at desc);

create table if not exists public.tce_monitor_runs (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.tce_accounts(id) on delete cascade, run_type text not null check (run_type in ('POSITION_MONITOR','POOL_SCAN','FULL_SCAN')), started_at timestamptz not null default now(), finished_at timestamptz,
  market_session boolean not null default false, active_position_count integer not null default 0, pool_count integer not null default 0, positions_monitored integer not null default 0, signals_found integer not null default 0, skipped boolean not null default false, skip_reason text, error_message text, metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_tce_monitor_runs_recent on public.tce_monitor_runs(account_id, started_at desc);

create table if not exists public.tce_cashout_events (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.tce_accounts(id) on delete cascade, symbol text not null, position_snapshot_id uuid references public.tce_position_snapshots(id) on delete set null,
  event_type text not null check (event_type in ('DIVIDEND_RIGHT','DIVIDEND_CASH','PRICE_CASHOUT','PARTIAL_EXIT','FULL_EXIT','RECYCLE')), event_date date, ex_right_date date, payment_date date,
  gross_cash bigint not null default 0, tax bigint not null default 0, net_cash bigint not null default 0, capital_released bigint not null default 0, realized_pnl bigint not null default 0, notes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_tce_cashout_events_recent on public.tce_cashout_events(account_id, event_date desc, created_at desc);

create or replace function public.tce_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_tce_strategy_config_updated_at on public.tce_strategy_config;
create trigger trg_tce_strategy_config_updated_at before update on public.tce_strategy_config for each row execute function public.tce_touch_updated_at();
drop trigger if exists trg_tce_pool_entries_updated_at on public.tce_pool_entries;
create trigger trg_tce_pool_entries_updated_at before update on public.tce_pool_entries for each row execute function public.tce_touch_updated_at();

create or replace view public.tce_active_pool with (security_invoker=true) as
select * from (select p.*, row_number() over (partition by p.account_id order by p.rank asc, p.score desc nulls last, p.observed_at desc) as pool_position from public.tce_pool_entries p where p.status in ('WATCHING','TRIGGERED','POSITIONED')) ranked where pool_position <= 5;

create or replace view public.tce_position_capacity with (security_invoker=true) as
select a.id account_id, coalesce(c.max_positions,2) max_positions, count(p.symbol)::integer active_positions, greatest(coalesce(c.max_positions,2)-count(p.symbol)::integer,0) open_slots
from public.tce_accounts a left join public.tce_strategy_config c on c.account_id=a.id left join public.tce_positions p on p.account_id=a.id and p.status is distinct from 'CLOSED' group by a.id,c.max_positions;

alter table public.tce_strategy_config enable row level security;
alter table public.tce_pool_entries enable row level security;
alter table public.tce_position_snapshots enable row level security;
alter table public.tce_monitor_runs enable row level security;
alter table public.tce_cashout_events enable row level security;

drop policy if exists tce_strategy_config_read on public.tce_strategy_config;
create policy tce_strategy_config_read on public.tce_strategy_config for select using (true);
drop policy if exists tce_pool_entries_read on public.tce_pool_entries;
create policy tce_pool_entries_read on public.tce_pool_entries for select using (true);
drop policy if exists tce_position_snapshots_read on public.tce_position_snapshots;
create policy tce_position_snapshots_read on public.tce_position_snapshots for select using (true);
drop policy if exists tce_monitor_runs_read on public.tce_monitor_runs;
create policy tce_monitor_runs_read on public.tce_monitor_runs for select using (true);
drop policy if exists tce_cashout_events_read on public.tce_cashout_events;
create policy tce_cashout_events_read on public.tce_cashout_events for select using (true);
