-- TCE account data migration
--
-- Purpose:
--   Make the existing account-scoped data belong to the authenticated user
--   account without changing business data or primary keys.
--
-- The migration is intentionally idempotent. It resolves the destination
-- account by users.email -> tce_accounts.name (USER:<email>), persists the
-- users.id -> tce_accounts.id mapping, then validates all account-scoped rows.
-- It does NOT copy/delete positions, orders, pools, cashflows, or cycles.

begin;

-- 1. Persist the canonical user -> account relationship.
alter table public.tce_accounts
  add column if not exists user_id uuid;

DO $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tce_accounts_user_id_fkey'
      and conrelid = 'public.tce_accounts'::regclass
  ) then
    alter table public.tce_accounts
      add constraint tce_accounts_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;
end $$;

-- 2. Backfill the migrated account from the existing naming convention.
update public.tce_accounts a
set user_id = u.id,
    updated_at = now()
from public.users u
where a.user_id is null
  and lower(a.name) = lower('USER:' || u.email);

create unique index if not exists uq_tce_accounts_user_id
  on public.tce_accounts(user_id)
  where user_id is not null;

-- 3. Guard against ambiguous mappings. A user must resolve to at most one
-- account before the dashboard starts reading account-scoped data.
DO $$
begin
  if exists (
    select 1
    from public.tce_accounts
    where user_id is not null
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'TCE migration aborted: a user maps to multiple accounts';
  end if;
end $$;

-- 4. Validate the known migrated account. These assertions fail the migration
-- instead of silently producing a dashboard with missing data.
DO $$
declare
  target_user uuid;
  target_account uuid;
begin
  select id into target_user
  from public.users
  where lower(email) = lower('phanthienquoc@outlook.com')
  limit 1;

  if target_user is null then
    raise exception 'TCE migration aborted: destination user not found';
  end if;

  select id into target_account
  from public.tce_accounts
  where user_id = target_user;

  if target_account is null then
    raise exception 'TCE migration aborted: destination TCE account not found';
  end if;

  -- Existing live positions must remain attached to the destination account.
  if exists (
    select 1 from public.tce_positions
    where symbol in ('PTB','SSI')
      and account_id <> target_account
  ) then
    raise exception 'TCE migration aborted: PTB/SSI positions belong to another account';
  end if;
end $$;

-- 5. Index every account-scoped table used by the dashboard/data pipeline.
create index if not exists idx_tce_positions_account_id on public.tce_positions(account_id);
create index if not exists idx_tce_orders_account_id on public.tce_orders(account_id);
create index if not exists idx_tce_pool_entries_account_rank on public.tce_pool_entries(account_id, rank);
create index if not exists idx_tce_buy_candidates_account_rank on public.tce_buy_candidates(account_id, rank);
create index if not exists idx_tce_cashflows_account_id on public.tce_cashflows(account_id);
create index if not exists idx_tce_cycles_account_id on public.tce_cycles(account_id);

commit;
