import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import { AuthRepository } from './auth.repository';
import type { PostgresService } from '../db/postgres.client';

type QueryCall = { sql: string; values: unknown[] };

function makeHarness(selectRows: unknown[], updateCounts: number[] = []) {
  const calls: QueryCall[] = [];
  let committed = false;
  let updateIndex = 0;
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (/^SELECT s\.id,/i.test(sql.trim())) {
        return { rows: selectRows, rowCount: selectRows.length };
      }
      if (/^SELECT id FROM public\.mfa_recovery_codes/i.test(sql.trim())) {
        return { rows: selectRows, rowCount: selectRows.length };
      }
      if (/^UPDATE/i.test(sql.trim())) {
        const rowCount = updateCounts[updateIndex++] ?? 1;
        return { rows: [], rowCount };
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  const postgres = {
    query: async () => ({ rows: [], rowCount: 1 }),
    transaction: async <T>(work: (connection: PoolClient) => Promise<T>): Promise<T> => {
      const result = await work(client);
      committed = true;
      return result;
    },
  } as unknown as PostgresService;
  const repo = new AuthRepository(postgres);
  return { repo, calls, committed: () => committed };
}

test('refresh rotation locks the current session and inserts the replacement in one transaction', async () => {
  const harness = makeHarness([{
    id: 'old-session',
    user_id: 'user-1',
    family_id: 'family-1',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
    replaced_by: null,
    role: 'USER',
  }]);

  const result = await harness.repo.rotateRefreshToken(
    'old-hash',
    'new-hash',
    new Date(Date.now() + 60_000),
    '127.0.0.1',
    'unit-test'
  );

  assert.equal(result.reuse_detected, false);
  assert.equal(result.user_id, 'user-1');
  assert.ok(result.new_session_id);
  assert.match(harness.calls[0].sql, /FOR UPDATE OF s/i);
  assert.ok(harness.calls.some(call => /UPDATE public\.refresh_sessions SET replaced_by/i.test(call.sql)));
  assert.ok(harness.calls.some(call => /INSERT INTO public\.refresh_sessions/i.test(call.sql)));
  assert.equal(harness.committed(), true);
});

test('refresh-token replay commits family revocation before returning unauthorized', async () => {
  const harness = makeHarness([{
    id: 'old-session',
    user_id: 'user-1',
    family_id: 'family-1',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: new Date().toISOString(),
    replaced_by: 'replacement-session',
    role: 'USER',
  }]);

  await assert.rejects(
    harness.repo.rotateRefreshToken('old-hash', 'next-hash', new Date(Date.now() + 60_000)),
    /Refresh token reuse detected/
  );

  assert.ok(harness.calls.some(call =>
    /UPDATE public\.refresh_sessions SET revoked_at = COALESCE\(revoked_at, now\(\)\) WHERE family_id/i.test(call.sql)
  ));
  assert.equal(harness.committed(), true);
});

test('recovery code is selected with a row lock and marked used in the same transaction', async () => {
  const harness = makeHarness([{ id: 'recovery-1' }]);

  const consumed = await harness.repo.consumeRecoveryCode('user-1', 'code-hash');

  assert.equal(consumed, true);
  assert.match(harness.calls[0].sql, /FOR UPDATE SKIP LOCKED/i);
  assert.ok(harness.calls.some(call => /UPDATE public\.mfa_recovery_codes SET used_at/i.test(call.sql)));
  assert.equal(harness.committed(), true);
});

test('already-used or unknown recovery codes cannot be consumed again', async () => {
  const harness = makeHarness([]);

  const consumed = await harness.repo.consumeRecoveryCode('user-1', 'used-code-hash');

  assert.equal(consumed, false);
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.committed(), true);
});
