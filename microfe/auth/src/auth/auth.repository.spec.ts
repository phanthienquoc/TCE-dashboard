import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository';

function fakePostgres(options: {
  session?: { id: string; user_id: string; family_id: string; expires_at: Date; revoked_at: Date | null; role: string } | null;
  nextId?: string;
} = {}) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const session = options.session === undefined
    ? { id: 'old-session', user_id: 'user-1', family_id: 'family-1', expires_at: new Date(Date.now() + 60_000), revoked_at: null, role: 'USER' }
    : options.session;
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.includes('SELECT s.id, s.user_id')) return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
      if (sql.includes('INSERT INTO public.refresh_sessions') && sql.includes('RETURNING id')) {
        return { rows: [{ id: options.nextId ?? 'new-session' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  const postgres = {
    async transaction<T>(run: (client: typeof client) => Promise<T>): Promise<T> {
      return run(client);
    },
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  };
  return { repo: new AuthRepository(postgres as never), calls };
}

test('refresh rotation is transactional, preserves the session family, and stores only the token hash', async () => {
  const { repo, calls } = fakePostgres();
  const result = await repo.rotateRefreshToken('old-hash', 'new-hash', new Date(Date.now() + 60_000), '127.0.0.1', 'test-agent');

  assert.equal(result.new_session_id, 'new-session');
  assert.equal(result.reuse_detected, false);
  assert.ok(calls.some(call => call.sql.includes('FOR UPDATE OF s')));
  assert.ok(calls.some(call => call.sql.includes('INSERT INTO public.refresh_sessions') && call.values.includes('new-hash')));
  assert.ok(calls.some(call => call.sql.includes('replaced_by = $2') && call.values.includes('new-session')));
  assert.equal(calls.some(call => call.sql.includes('.rpc(') || call.sql.includes('rotate_refresh_token(')), false);
});

test('replayed revoked refresh token revokes the active token family before rejection', async () => {
  const revokedSession = {
    id: 'old-session', user_id: 'user-1', family_id: 'family-1',
    expires_at: new Date(Date.now() + 60_000), revoked_at: new Date(), role: 'USER',
  };
  const { repo, calls } = fakePostgres({ session: revokedSession });
  await assert.rejects(
    repo.rotateRefreshToken('replayed-hash', 'unused-new-hash', new Date(Date.now() + 60_000)),
    (error: unknown) => error instanceof UnauthorizedException
      && (error.getResponse() as { code?: string }).code === 'REFRESH_TOKEN_REUSE',
  );
  assert.ok(calls.some(call => call.sql.includes('WHERE family_id = $1 AND revoked_at IS NULL')
    && call.values[0] === 'family-1'));
});

test('recovery code consumption is a single atomic SQL operation', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const postgres = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [{ id: 'recovery-1' }], rowCount: 1 };
    },
    async transaction<T>(run: (client: never) => Promise<T>): Promise<T> {
      return run({} as never);
    },
  };
  const repo = new AuthRepository(postgres as never);
  assert.equal(await repo.consumeRecoveryCode('user-1', 'code-hash'), true);
  assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(calls[0].sql, /used_at = now\(\)/);
  assert.deepEqual(calls[0].values, ['user-1', 'code-hash']);
});
