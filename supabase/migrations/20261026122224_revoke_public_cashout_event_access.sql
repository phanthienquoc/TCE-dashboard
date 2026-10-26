-- Keep account-specific cashout events server-owned.
-- The monitor is the only runtime consumer found in TCE-dashboard and writes
-- through the existing server-side service-role client. No browser table
-- consumer was found in this repository.
-- The owner/admin authorized scoped Supabase remediation on the shared
-- non-production project on 2026-10-26.
--
-- This migration changes only access control. It reads, inserts, updates and
-- deletes no cashout/account rows and does not affect positions, orders,
-- strategy configuration, engine state or LIVE-mode flags.

drop policy if exists tce_cashout_events_read on public.tce_cashout_events;
revoke all privileges on table public.tce_cashout_events
  from public, anon, authenticated;
alter table public.tce_cashout_events enable row level security;
