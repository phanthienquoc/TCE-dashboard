import {
  TCE_EVENT_SCHEMA_VERSION,
  type TceEventPublisherPort,
  type TceRuntimeEvent,
} from '@tce/contracts';

export type MonitorSnapshotEventInput = Readonly<{
  snapshotId: string;
  positionId: string;
  accountId: string;
  symbol: string;
  signal?: string;
  occurredAt: string;
  correlationId: string;
}>;

export function createMonitorSnapshotEvent(
  input: MonitorSnapshotEventInput
): TceRuntimeEvent<'monitor.snapshot.created'> {
  return {
    eventId: `monitor.snapshot.created:${input.snapshotId}`,
    eventType: 'monitor.snapshot.created',
    schemaVersion: TCE_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt,
    producer: 'tce-monitor',
    correlationId: input.correlationId,
    accountId: input.accountId,
    aggregateId: input.positionId,
    data: {
      positionId: input.positionId,
      symbol: input.symbol,
      observedAt: input.occurredAt,
      signal: input.signal,
    },
  };
}

/**
 * Snapshot persistence is authoritative for existing Monitor behavior.
 * Event publication is best-effort until the outbox and monitor writes share
 * a database transaction; a publisher outage must not stop snapshot/audit flow.
 */
export async function publishMonitorSnapshotBestEffort(
  publisher: TceEventPublisherPort,
  event: TceRuntimeEvent<'monitor.snapshot.created'>,
  onFailure: (error: unknown) => void
): Promise<boolean> {
  try {
    await publisher.publish(event);
    return true;
  } catch (error) {
    onFailure(error);
    return false;
  }
}
