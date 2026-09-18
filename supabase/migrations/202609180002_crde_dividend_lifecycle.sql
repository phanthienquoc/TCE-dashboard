-- CRDE Phase 6: persist dividend/T+2 lifecycle on the existing authoritative position table.
-- No new CRDE runtime table is introduced. Lifecycle audit evidence reuses tce_cashout_events.notes.
alter table public.tce_positions
  add column if not exists dividend_lifecycle text not null default 'ELIGIBLE',
  add column if not exists ex_dividend_at timestamptz,
  add column if not exists record_date date,
  add column if not exists dividend_payment_at timestamptz,
  add column if not exists lifecycle_updated_at timestamptz,
  add column if not exists lifecycle_idempotency_key text;

create index if not exists idx_tce_positions_dividend_lifecycle
  on public.tce_positions(account_id, dividend_lifecycle);

create unique index if not exists idx_tce_positions_lifecycle_idempotency
  on public.tce_positions(account_id, symbol, lifecycle_idempotency_key)
  where lifecycle_idempotency_key is not null;

comment on column public.tce_positions.dividend_lifecycle is
  'CRDE dividend lifecycle state persisted on the authoritative position row.';
comment on column public.tce_positions.lifecycle_idempotency_key is
  'Last applied CRDE lifecycle idempotency key; duplicate lifecycle commands are ignored.';
