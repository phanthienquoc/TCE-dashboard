-- TCE multi-account dashboard
-- Private portfolio data is owned by users.id via account_id.
-- Pools + next positions are intentionally shared across all accounts.

create table if not exists public.tce_shared_pools (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  rank integer,
  status text not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.tce_shared_next_positions (
  id uuid primary key default gen_random_uuid(),
  rank integer not null,
  symbol text not null,
  target_quantity numeric,
  target_price numeric,
  reason text,
  status text not null default 'AVAILABLE',
  updated_at timestamptz not null default now()
);

create index if not exists idx_tce_positions_account_status
  on public.tce_positions(account_id, status);

-- SAFETY-CHECKED ONE-TIME DATA MIGRATION
-- The block only migrates when there is exactly one distinct owner among
-- currently open positions. It then moves the related account-scoped TCE data
-- to phanthienquoc@outlook.com. Closed/history rows are moved too when they
-- belong to that same legacy account.
DO $$
declare
  target_user uuid;
  legacy_user uuid;
  owner_count integer;
begin
  select id into target_user
  from public.users
  where lower(email) = lower('phanthienquoc@outlook.com');

  if target_user is null then
    raise exception 'Target user phanthienquoc@outlook.com does not exist';
  end if;

  select count(distinct account_id), min(account_id)
    into owner_count, legacy_user
  from public.tce_positions
  where status <> 'CLOSED';

  if owner_count = 0 then
    raise notice 'No open positions to migrate';
    return;
  end if;

  if owner_count > 1 then
    raise exception 'Aborted: open positions belong to % different accounts; migrate explicitly instead', owner_count;
  end if;

  if legacy_user = target_user then
    raise notice 'Positions already belong to target user';
    return;
  end if;

  update public.tce_positions set account_id = target_user where account_id = legacy_user;
  update public.tce_position_snapshots set account_id = target_user where account_id = legacy_user;
  update public.tce_cashout_events set account_id = target_user where account_id = legacy_user;
  update public.tce_monitor_runs set account_id = target_user where account_id = legacy_user;
  update public.tce_strategy_config set account_id = target_user where account_id = legacy_user;

  -- Optional account-scoped tables: only run when they exist.
  if to_regclass('public.tce_orders') is not null then
    execute 'update public.tce_orders set account_id = $1 where account_id = $2' using target_user, legacy_user;
  end if;

  raise notice 'Migrated TCE portfolio from % to %', legacy_user, target_user;
end $$;
