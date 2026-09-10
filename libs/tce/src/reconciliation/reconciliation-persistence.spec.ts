import { InMemoryReconciliationPersistence } from './reconciliation-persistence';

describe('InMemoryReconciliationPersistence', () => {
  it('stores and retrieves reconciliation results by run id', async () => {
    const persistence = new InMemoryReconciliationPersistence();
    const record = {
      runId: 'run-1',
      accountId: 'acct-1',
      environment: 'PAPER' as const,
      recordedAt: '2026-09-11T00:00:00.000Z',
      deltas: [{ disposition: 'CONVERGED' as const, reason: 'consistent' }],
    };

    await persistence.save(record);

    await expect(persistence.get('run-1')).resolves.toEqual(record);
  });

  it('is idempotent for a repeated run id', async () => {
    const persistence = new InMemoryReconciliationPersistence();
    const first = {
      runId: 'run-1',
      accountId: 'acct-1',
      environment: 'PAPER' as const,
      recordedAt: '2026-09-11T00:00:00.000Z',
      deltas: [{ disposition: 'MISSING_PROVIDER_ORDER' as const, localOrderId: 'local-1', reason: 'missing' }],
    };
    const second = { ...first, recordedAt: '2026-09-11T00:01:00.000Z' };

    await persistence.save(first);
    await persistence.save(second);

    await expect(persistence.get('run-1')).resolves.toEqual(first);
  });

  it('returns undefined for an unknown run', async () => {
    const persistence = new InMemoryReconciliationPersistence();
    await expect(persistence.get('unknown')).resolves.toBeUndefined();
  });
});
