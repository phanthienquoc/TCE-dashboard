-- Least-privilege follow-up for the already-applied monitor replay schema.
-- This migration is a source proposal only; do not apply until the connected
-- Supabase environment is verified non-production and migration provenance is safe.
-- The publisher only inserts immutable runtime events. Replay workers only read
-- queue rows and compare-and-set update delivery state.

revoke all privileges on table public.tce_runtime_events
  from public, anon, authenticated, service_role;
grant insert on table public.tce_runtime_events to service_role;

revoke all privileges on table public.tce_monitor_event_replay
  from public, anon, authenticated, service_role;
grant select, update on table public.tce_monitor_event_replay to service_role;

alter table public.tce_runtime_events enable row level security;
alter table public.tce_monitor_event_replay enable row level security;
