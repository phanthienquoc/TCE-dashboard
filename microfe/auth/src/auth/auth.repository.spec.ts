import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from './auth.repository';

type Step = { rows?: any[]; rowCount?: number };
function repositoryWithSteps(steps: Step[]) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  let transactionCount = 0;
  const db = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      const step = steps.shift();
      if (!step) throw new Error('Unexpected SQL query: ' + sql);
      return { rows: step.rows ?? [], rowCount: step.rowCount ?? 0 };
    },
    async transaction<T>(work: (client: any) => Promise<T>): Promise<T> {
      transactionCount++;
      return work({ query: db.query.bind(db) });
    },
  };
  return { repo: new AuthRepository(db as any), calls, transactionCount: () => transactionCount };
}

const activeSession = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  token_hash: 'old-hash',
  family_id: '33333333-3333-4333-8333-333333333333',
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  revoked_at: null,
  replaced_by: null,
  role: 'USER',
};

test('refresh rotation locks and consumes old session before inserting replacement in one transaction', async () => {
  const db = repositoryWithSteps([
    { rows: [activeSession] },
    { rowCount: 1 },
    { rowCount: 1 },
  ]);
  const result = await db.repo.rotateRefreshToken('old-hash', 'new-hash', new Date(Date.now() + 120_000));
  assert.equal(db.transactionCount(), 1);
  assert.equal(result.reuse_detected, false);
  assert.equal(result.user_id, activeSession.user_id);
  assert.equal(result.role, 'USER');
  assert.ok(result.new_session_id);
  assert.match(db.calls[0].sql, /FOR UPDATE OF s/);
  assert.match(db.calls[1].sql, /replaced_by = \$2/);
  assert.match(db.calls[2].sql, /INSERT INTO public\.refresh_sessions/);
  assert.equal(db.calls[2].values[2], 'new-hash');
});

test('refresh replay revokes remaining sessions in the same token family', async () => {
  const db = repositoryWithSteps([
    { rows: [{ ...activeSession, revoked_at: new Date().toISOString(), replaced_by: '44444444-4444-4444-8444-444444444444' }] },
    { rowCount: 1 },
  ]);
  const result = await db.repo.rotateRefreshToken('old-hash', 'attacker-hash', new Date());
  assert.equal(result.reuse_detected, true);
  assert.equal(db.transactionCount(), 1);
  assert.match(db.calls[1].sql, /WHERE family_id = \$1 AND revoked_at IS NULL/);
  assert.deepEqual(db.calls[1].values, [activeSession.family_id]);
});

test('expired refresh token is rejected without being classified as replay', async () => {
  const db = repositoryWithSteps([
    { rows: [{ ...activeSession, expires_at: new Date(Date.now() - 60_000).toISOString() }] },
  ]);
  await assert.rejects(
    () => db.repo.rotateRefreshToken('old-hash', 'new-hash', new Date()),
    (error: unknown) => error instanceof UnauthorizedException,
  );
  assert.equal(db.calls.length, 1);
});

test('recovery code and MFA challenge are consumed atomically', async () => {
  const db = repositoryWithSteps([
    { rows: [{ id: 'challenge-id' }] },
    { rows: [{ id: 'recovery-id' }] },
    { rowCount: 1 },
    { rowCount: 1 },
  ]);
  const ok = await db.repo.consumeRecoveryCodeAndMfaChallenge('user-id', 'code-hash', 'challenge-hash');
  assert.equal(ok, true);
  assert.equal(db.transactionCount(), 1);
  assert.match(db.calls[0].sql, /purpose = 'mfa'/);
  assert.match(db.calls[1].sql, /used_at IS NULL/);
  assert.match(db.calls[2].sql, /SET used_at = now\(\)/);
  assert.match(db.calls[3].sql, /DELETE FROM public\.auth_passkey_challenges/);
});

test('invalid recovery code does not burn the MFA challenge', async () => {
  const db = repositoryWithSteps([
    { rows: [{ id: 'challenge-id' }] },
    { rows: [] },
  ]);
  const ok = await db.repo.consumeRecoveryCodeAndMfaChallenge('user-id', 'wrong-hash', 'challenge-hash');
  assert.equal(ok, false);
  assert.equal(db.transactionCount(), 1);
  assert.equal(db.calls.length, 2);
});
