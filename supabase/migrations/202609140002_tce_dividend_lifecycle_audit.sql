-- Durable append-only audit evidence for the Phase 9 dividend lifecycle.
-- The service-role Supabase adapter is the write path; RLS prevents accidental
-- client-side writes while still allowing the privileged adapter to persist evidence.

begin;

create table if not exists public.tce_dividend_lifecycle_audit (
  id uuid primary key default gen_random_uuid(),
  audit_id text not null,
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  environment text not null,
  event_id text not null,
  symbol text not null,
  state text not null,
  observed_at timestamptz not null,
  source_revision text not null,
  authoritative boolean not null,
  evidence_hash text not null,
  created_at timestamptz not null default now(),
  constraint uq_tce_dividend_lifecycle_audit_audit_id unique (audit_id),
  constraint uq_tce_dividend_lifecycle_audit_evidence unique (account_id, environment, event_id, evidence_hash),
  constraint ck_tce_dividend_lifecycle_audit_environment check (environment in ('PAPER','ASSISTED','LIVE')),
  constraint ck_tce_dividend_lifecycle_audit_state check (
    state in ('ANNOUNCED','ELIGIBLE','EX_DIVIDEND','T2_PENDING','AVAILABLE','DIVIDEND_CONFIRMED','MISSED','INVALIDATED','CORPORATE_ACTION_RECONCILIATION_REQUIRED')
  )
);

create index if not exists idx_tce_dividend_lifecycle_audit_event_time
  on public.tce_dividend_lifecycle_audit(account_id, environment, event_id, observed_at, audit_id);

alter table public.tce_dividend_lifecycle_audit enable row level security;

commit;
