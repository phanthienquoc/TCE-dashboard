import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryReconciliationPersistence } from './reconciliation-persistence';

test('InMemoryReconciliationPersistence stores and retrieves reconciliation results by run id', async () => {
  const persistence = new InMemoryReconciliationPersistence();
  const record = {
    runId: 'run-1',
    accountId: 'acct-1',
    environment: 'PAPER' as const,
    recordedAt: '2026-09-11T00:00:00.000Z',
    deltas: [{ disposition: 'CONVERGED' as const, reason: 'consistent' }],
  };

  await persistence.save(record);
  assert.deepEqual(await persistence.get('run-1'), record);
});

test('InMemoryReconciliationPersistence is idempotent for a repeated run id', async () => {
  const persistence = new InMemoryReconciliationPersistence();
  const first = {
    runId: 'run-1',
    accountId: 'acct-1',
    environment: 'PAPER' as const,
    recordedAt: '2026-09-11T00:00:00.000Z',
    deltas: [
      {
        disposition: 'MISSING_PROVIDER_ORDER' as const,
        localOrderId: 'local-1',
        reason: 'missing',
      },
    ],
  };
  const second = { ...first, recordedAt: '2026-09-11T00:01:00.000Z' };

  await persistence.save(first);
  await persistence.save(second);
  assert.deepEqual(await persistence.get('run-1'), first);
});

test('InMemoryReconciliationPersistence returns undefined for an unknown run', async () => {
  const persistence = new InMemoryReconciliationPersistence();
  assert.equal(await persistence.get('unknown'), undefined);
});
