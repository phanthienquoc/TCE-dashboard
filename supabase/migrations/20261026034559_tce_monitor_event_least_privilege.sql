-- Least-privilege grants for the TCE event publisher and replay worker.
-- Applied to the connected Supabase project on 2026-10-26 as migration
-- version 20261026034559. The publisher inserts/reads immutable runtime
-- events; replay workers read rows and compare-and-set update delivery state.
-- No position, order, account, strategy or LIVE-mode data is changed.

revoke all privileges on table public.tce_runtime_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.tce_runtime_events to service_role;

revoke all privileges on table public.tce_monitor_event_replay
  from public, anon, authenticated, service_role;
grant select, update on table public.tce_monitor_event_replay to service_role;

alter table public.tce_runtime_events enable row level security;
alter table public.tce_monitor_event_replay enable row level security;
