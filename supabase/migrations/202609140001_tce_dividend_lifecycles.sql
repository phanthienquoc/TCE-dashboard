-- Persist account-scoped dividend lifecycle state for the TCE Phase 9 flow.
-- The identity is account + environment + provider dividend event; repeated
-- saves are safe through the unique constraint and adapter upsert.

begin;

create table if not exists public.tce_dividend_lifecycles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  environment text not null,
  symbol text not null,
  event_id text not null,
  lifecycle text not null,
  ex_dividend_at timestamptz not null,
  record_at timestamptz,
  payment_at timestamptz,
  source text not null,
  source_version text,
  updated_at timestamptz not null default now(),
  constraint tce_dividend_lifecycles_state_check check (
    lifecycle in ('UNKNOWN','ANNOUNCED','ELIGIBLE','EX_DIVIDEND','T2_PENDING','DIVIDEND_CONFIRMED','MISSED','INVALIDATED')
  ),
  constraint uq_tce_dividend_lifecycles_identity unique (account_id, environment, event_id)
);

create index if not exists idx_tce_dividend_lifecycles_account_symbol
  on public.tce_dividend_lifecycles(account_id, symbol);

create index if not exists idx_tce_dividend_lifecycles_ex_dividend
  on public.tce_dividend_lifecycles(ex_dividend_at);

commit;
