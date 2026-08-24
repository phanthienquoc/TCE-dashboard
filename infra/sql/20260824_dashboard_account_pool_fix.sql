-- TCE dashboard account/pool data alignment
--
-- The dashboard API receives users.id from JWT, while TCE account-scoped
-- tables reference tce_accounts.id.  Persist the user -> account mapping so
-- account-scoped reads/writes do not compare incompatible UUIDs.

alter table public.tce_accounts
  add column if not exists user_id uuid;

DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tce_accounts_user_id_fkey'
      and conrelid = 'public.tce_accounts'::regclass
  ) then
    alter table public.tce_accounts
      add constraint tce_accounts_user_id_fkey
      foreign key (user_id) references public.users(id) on delete set null;
  end if;
end $$;

-- Backfill the account already created for the migrated user.  The existing
-- account naming convention is USER:<email>; this is only a compatibility
-- backfill and the persisted user_id becomes the authoritative mapping.
update public.tce_accounts a
set user_id = u.id,
    updated_at = now()
from public.users u
where a.user_id is null
  and lower(a.name) = lower('USER:' || u.email);

create unique index if not exists uq_tce_accounts_user_id
  on public.tce_accounts(user_id)
  where user_id is not null;

create index if not exists idx_tce_pool_entries_account_rank
  on public.tce_pool_entries(account_id, rank);

create index if not exists idx_tce_buy_candidates_account_rank
  on public.tce_buy_candidates(account_id, rank);
