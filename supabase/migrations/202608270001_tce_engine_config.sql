-- Persist account-scoped TCE engine strategy configuration.
begin;

create table if not exists public.tce_strategy_config (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  engine_enabled boolean not null default false,
  profit_target_pct numeric not null default 10,
  max_positions integer not null default 5,
  max_asset_allocation_pct numeric not null default 40,
  buy_quantity_step integer not null default 100,
  buy_from_remaining_budget boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint uq_tce_strategy_config_account unique (account_id)
);

create index if not exists idx_tce_strategy_config_account on public.tce_strategy_config(account_id);
commit;
