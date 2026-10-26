import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationPath = join(
  __dirname,
  '../../../../supabase/migrations/20261026122224_revoke_public_cashout_event_access.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const sql = migration.replace(/--[^\n]*/g, '');

test('TCE-SEC-004 migration removes public policy and browser grants only', () => {
  assert.match(
    migration,
    /drop policy if exists tce_cashout_events_read on public\.tce_cashout_events;/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.tce_cashout_events\s+from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /alter table public\.tce_cashout_events enable row level security;/i,
  );
  assert.doesNotMatch(
    sql,
    /\b(insert\s+into|update\s+public\.tce_cashout_events|delete\s+from\s+public\.tce_cashout_events|truncate\s+public\.tce_cashout_events)\b/i,
  );
  assert.doesNotMatch(
    sql,
    /\bgrant\s+[^;]*\b(public|anon|authenticated)\b/i,
  );
});
