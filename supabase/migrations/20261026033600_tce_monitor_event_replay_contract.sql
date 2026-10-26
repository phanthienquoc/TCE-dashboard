-- TCE durable monitor event store and replay queue.
-- Applied to the connected Supabase project on 2026-10-26 as migration
-- version 20261026033600. This is additive and does not change positions,
-- orders, engine configuration, LIVE-mode flags or existing account rows.
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
revoke all on table public.tce_runtime_events from public, anon, authenticated;
grant all on table public.tce_runtime_events to service_role;

-- Snapshot rows carry enough immutable metadata to reconstruct the exact event.
alter table public.tce_position_snapshots
  add column if not exists position_id uuid,
  add column if not exists correlation_id text,
  add column if not exists event_occurred_at timestamptz;

create table if not exists public.tce_monitor_event_replay (
  snapshot_id uuid primary key,
  event_id text not null unique,
  position_id uuid not null,
  account_id uuid not null,
  symbol text not null,
  signal text not null,
  occurred_at timestamptz not null,
  correlation_id text not null,
  state text not null default 'pending'
    check (state in ('pending', 'delivered', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz default (now() + interval '5 seconds'),
  last_error_code text,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tce_monitor_event_replay_due
  on public.tce_monitor_event_replay(next_attempt_at, created_at)
  where state = 'pending';

alter table public.tce_monitor_event_replay enable row level security;
revoke all on table public.tce_monitor_event_replay from public, anon, authenticated;
grant all on table public.tce_monitor_event_replay to service_role;

create or replace function public.enqueue_tce_monitor_snapshot_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Legacy/non-monitor snapshot producers remain unaffected.
  if new.position_id is null
     or new.correlation_id is null
     or new.event_occurred_at is null then
    return new;
  end if;

  insert into public.tce_monitor_event_replay (
    snapshot_id, event_id, position_id, account_id, symbol, signal,
    occurred_at, correlation_id, state, attempt_count, next_attempt_at
  ) values (
    new.id,
    'monitor.snapshot.created:' || new.id::text,
    new.position_id,
    new.account_id,
    new.symbol,
    new.signal,
    new.event_occurred_at,
    new.correlation_id,
    'pending',
    0,
    now() + interval '5 seconds'
  )
  on conflict (snapshot_id) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_tce_monitor_snapshot_event() from public, anon, authenticated;
grant execute on function public.enqueue_tce_monitor_snapshot_event() to service_role;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_tce_monitor_snapshot_enqueue_event'
      and tgrelid = 'public.tce_position_snapshots'::regclass
      and not tgisinternal
  ) then
    create trigger trg_tce_monitor_snapshot_enqueue_event
      after insert on public.tce_position_snapshots
      for each row execute function public.enqueue_tce_monitor_snapshot_event();
  end if;
end;
$$;
