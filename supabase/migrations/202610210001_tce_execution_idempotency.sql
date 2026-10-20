-- Durable request deduplication for TCE execution orchestration.
-- This table is additive and is not wired to live execution until an adapter is
-- configured and the runtime compatibility rollout is explicitly approved.
create table if not exists public.tce_execution_idempotency (
  account_id text not null,
  environment text not null,
  idempotency_key text not null,
  command_fingerprint text not null,
  execution_intent_id text not null,
  correlation_id text not null,
  client_request_id text not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'UNKNOWN')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, environment, idempotency_key),
  check (
    (status = 'PENDING' and result is null)
    or (status in ('COMPLETED', 'UNKNOWN'))
  )
);

create index if not exists idx_tce_execution_idempotency_intent
  on public.tce_execution_idempotency(account_id, environment, execution_intent_id);

create index if not exists idx_tce_execution_idempotency_updated
  on public.tce_execution_idempotency(updated_at desc);
