import type { ReconciliationDelta } from './order-state-reconciler';

export type ReconciliationPersistenceRecord = {
  runId: string;
  accountId: string;
  environment: 'PAPER' | 'LIVE';
  recordedAt: string;
  deltas: readonly ReconciliationDelta[];
};

export type TceReconciliationPersistencePort = {
  save(record: ReconciliationPersistenceRecord): Promise<void>;
  get(runId: string): Promise<ReconciliationPersistenceRecord | undefined>;
};

export class InMemoryReconciliationPersistence implements TceReconciliationPersistencePort {
  private readonly records = new Map<string, ReconciliationPersistenceRecord>();

  async save(record: ReconciliationPersistenceRecord): Promise<void> {
    if (this.records.has(record.runId)) return;
    this.records.set(record.runId, {
      ...record,
      deltas: record.deltas.map(delta => ({ ...delta })),
    });
  }

  async get(runId: string): Promise<ReconciliationPersistenceRecord | undefined> {
    const record = this.records.get(runId);
    return record ? { ...record, deltas: record.deltas.map(delta => ({ ...delta })) } : undefined;
  }
}
