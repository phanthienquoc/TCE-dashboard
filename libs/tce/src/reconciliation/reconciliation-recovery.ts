import type { TceReconciliationLifecycleEvent } from './reconciliation-lifecycle-events';
import {
  createReconciliationLifecycleEvents,
  type TceReconciliationLifecycleContext,
} from './reconciliation-lifecycle-events';
import type {
  ReconciliationPersistenceRecord,
  TceReconciliationPersistencePort,
} from './reconciliation-persistence';

export type TceReconciliationLifecycleSink = {
  has(eventId: string): Promise<boolean>;
  publish(event: TceReconciliationLifecycleEvent): Promise<void>;
};

export type TceReconciliationRecoveryRequest = Readonly<{
  runId: string;
  accountId: string;
  environment: ReconciliationPersistenceRecord['environment'];
  correlationId: string;
}>;

export type TceReconciliationRecoveryResult = Readonly<{
  status: 'REPLAYED' | 'ALREADY_REPLAYED' | 'NOT_FOUND';
  runId: string;
  eventCount: number;
  publishedCount: number;
  skippedCount: number;
}>;

export class InMemoryReconciliationLifecycleSink implements TceReconciliationLifecycleSink {
  private readonly events = new Map<string, TceReconciliationLifecycleEvent>();

  async has(eventId: string): Promise<boolean> {
    return this.events.has(eventId);
  }

  async publish(event: TceReconciliationLifecycleEvent): Promise<void> {
    if (this.events.has(event.eventId)) return;
    this.events.set(event.eventId, event);
  }

  list(): readonly TceReconciliationLifecycleEvent[] {
    return [...this.events.values()];
  }
}

function matchesRequest(
  record: ReconciliationPersistenceRecord,
  request: TceReconciliationRecoveryRequest,
): boolean {
  return (
    record.runId === request.runId &&
    record.accountId === request.accountId &&
    record.environment === request.environment
  );
}

export async function recoverReconciliationRun(
  request: TceReconciliationRecoveryRequest,
  persistence: TceReconciliationPersistencePort,
  sink: TceReconciliationLifecycleSink,
): Promise<TceReconciliationRecoveryResult> {
  const record = await persistence.get(request.runId);
  if (!record || !matchesRequest(record, request)) {
    return {
      status: 'NOT_FOUND',
      runId: request.runId,
      eventCount: 0,
      publishedCount: 0,
      skippedCount: 0,
    };
  }

  const context: TceReconciliationLifecycleContext = {
    runId: record.runId,
    accountId: record.accountId,
    environment: record.environment,
    correlationId: request.correlationId,
    observedAt: record.recordedAt,
  };
  const events = createReconciliationLifecycleEvents(context, record.deltas);
  let publishedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    if (await sink.has(event.eventId)) {
      skippedCount += 1;
      continue;
    }
    await sink.publish(event);
    publishedCount += 1;
  }

  return {
    status: publishedCount === 0 ? 'ALREADY_REPLAYED' : 'REPLAYED',
    runId: record.runId,
    eventCount: events.length,
    publishedCount,
    skippedCount,
  };
}
