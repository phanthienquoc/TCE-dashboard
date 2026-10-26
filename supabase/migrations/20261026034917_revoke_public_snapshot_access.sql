-- Keep TCE position snapshots server-owned.
-- Applied to the connected Supabase project on 2026-10-26 as migration
-- version 20261026034917. Inventory in the TCE-dashboard source found the
-- monitor as the only direct table consumer; it uses the NestJS service-role
-- client. Browser code has no direct client/table consumer in this repository.
-- This removes the permissive public SELECT policy and all direct browser grants.
-- The service_role and owner retain access for server-side monitor operations.

drop policy if exists tce_position_snapshots_read on public.tce_position_snapshots;
revoke all privileges on table public.tce_position_snapshots from public, anon, authenticated;
alter table public.tce_position_snapshots enable row level security;
