-- Base durable, provider-neutral event store used by the shared TCE publisher.
-- Idempotent schema artifact; application rollout and any production release remain separately controlled.
create table if not exists public.tce_runtime_events (
  event_id text primary key,
  event_type text not null,
  schema_version integer not null check (schema_version >= 1),
  occurred_at timestamptz not null,
  producer text not null,
  correlation_id text not null,
  account_id text,
  aggregate_id text,
  sequence bigint check (sequence is null or sequence >= 0),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tce_runtime_events_account_occurred
  on public.tce_runtime_events(account_id, occurred_at desc);

create index if not exists idx_tce_runtime_events_type_occurred
  on public.tce_runtime_events(event_type, occurred_at desc);

alter table public.tce_runtime_events enable row level security;
revoke all on table public.tce_runtime_events from anon, authenticated;
grant all on table public.tce_runtime_events to service_role;
