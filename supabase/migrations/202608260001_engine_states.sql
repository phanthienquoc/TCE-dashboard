-- Persist runtime engine state per TCE account.
-- The dashboard defaults all registered engines to ACTIVE until an explicit
-- INACTIVE state is saved for the account.

begin;

create table if not exists public.tce_engine_states (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  engine_id text not null,
  status text not null default 'ACTIVE',
  updated_at timestamptz not null default now(),
  constraint tce_engine_states_status_check check (status in ('ACTIVE', 'INACTIVE')),
  constraint uq_tce_engine_states_account_engine unique (account_id, engine_id)
);

create index if not exists idx_tce_engine_states_account
  on public.tce_engine_states(account_id);

commit;
