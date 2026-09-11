import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryReconciliationLifecycleSink,
  recoverReconciliationRun,
} from './reconciliation-recovery';
import { InMemoryReconciliationPersistence } from './reconciliation-persistence';

const record = {
  runId: 'run-1',
  accountId: 'account-1',
  environment: 'LIVE' as const,
  recordedAt: '2026-09-11T00:00:00.000Z',
  deltas: [
    {
      localOrderId: 'local-1',
      providerOrderId: 'ssi-1',
      disposition: 'PARTIAL_FILL' as const,
      localStatus: 'SUBMITTED',
      providerStatus: 'PARTIAL_FILLED',
      normalizedProviderState: 'PARTIALLY_FILLED' as const,
      localFilledQuantity: 20,
      providerFilledQuantity: 50,
      reason: 'Provider fill quantity is authoritative for reconciliation.',
    },
    {
      disposition: 'ORPHAN_PROVIDER_ORDER' as const,
      providerOrderId: 'ssi-orphan',
      reason: 'No local order.',
    },
  ],
};

async function persistence() {
  const store = new InMemoryReconciliationPersistence();
  await store.save(record);
  return store;
}

const request = {
  runId: 'run-1',
  accountId: 'account-1',
  environment: 'LIVE' as const,
  correlationId: 'corr-1',
};

test('replays a persisted reconciliation run into lifecycle events', async () => {
  const store = await persistence();
  const sink = new InMemoryReconciliationLifecycleSink();

  const result = await recoverReconciliationRun(request, store, sink);

  assert.deepEqual(result, {
    status: 'REPLAYED',
    runId: 'run-1',
    eventCount: 2,
    publishedCount: 2,
    skippedCount: 0,
  });
  assert.equal(sink.list().length, 2);
});

test('replaying the same run is idempotent', async () => {
  const store = await persistence();
  const sink = new InMemoryReconciliationLifecycleSink();

  await recoverReconciliationRun(request, store, sink);
  const result = await recoverReconciliationRun(request, store, sink);

  assert.deepEqual(result, {
    status: 'ALREADY_REPLAYED',
    runId: 'run-1',
    eventCount: 2,
    publishedCount: 0,
    skippedCount: 2,
  });
  assert.equal(sink.list().length, 2);
});

test('retry resumes after partial sink progress without duplicate events', async () => {
  const store = await persistence();
  const sink = new InMemoryReconciliationLifecycleSink();
  let attempts = 0;
  const flakySink = {
    has: (eventId: string) => sink.has(eventId),
    publish: async (event: Parameters<typeof sink.publish>[0]) => {
      attempts += 1;
      if (attempts === 2) throw new Error('transient sink failure');
      await sink.publish(event);
    },
  };

  await assert.rejects(() => recoverReconciliationRun(request, store, flakySink));
  assert.equal(sink.list().length, 1);

  const result = await recoverReconciliationRun(request, store, flakySink);
  assert.equal(result.publishedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(sink.list().length, 2);
});

test('missing or mismatched persisted runs fail closed without publishing', async () => {
  const store = new InMemoryReconciliationPersistence();
  const sink = new InMemoryReconciliationLifecycleSink();

  const result = await recoverReconciliationRun(request, store, sink);
  const mismatch = await recoverReconciliationRun(
    { ...request, accountId: 'wrong-account' },
    await persistence(),
    sink,
  );

  assert.equal(result.status, 'NOT_FOUND');
  assert.equal(mismatch.status, 'NOT_FOUND');
  assert.equal(sink.list().length, 0);
});
