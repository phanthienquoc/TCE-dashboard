import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTceEventEnvelope,
  isTceRuntimeEventType,
  type TceEventPublisherPort,
} from '@tce/contracts';
import {
  createMonitorSnapshotEvent,
  publishMonitorSnapshotBestEffort,
} from './monitor-event.js';

const input = {
  snapshotId: 'snapshot-123',
  positionId: 'position-123',
  accountId: 'account-123',
  symbol: 'DPM',
  signal: 'TAKE_PROFIT',
  occurredAt: '2026-10-21T12:00:00.000Z',
  correlationId: 'monitor-run:account-123:2026-10-21T12:00:00.000Z',
};

test('creates a versioned monitor snapshot event with stable identity and scope', () => {
  const event = createMonitorSnapshotEvent(input);
  assert.equal(event.eventId, 'monitor.snapshot.created:snapshot-123');
  assert.equal(event.eventType, 'monitor.snapshot.created');
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.accountId, input.accountId);
  assert.equal(event.aggregateId, input.positionId);
  assert.equal(event.correlationId, input.correlationId);
  assert.deepEqual(event.data, {
    positionId: input.positionId,
    symbol: input.symbol,
    observedAt: input.occurredAt,
    signal: input.signal,
  });
  assert.equal(isTceRuntimeEventType(event.eventType), true);
  assert.equal(isTceEventEnvelope(event), true);
});

test('best-effort publish does not propagate publisher failures to Monitor', async () => {
  let failure: unknown;
  let calls = 0;
  const publisher: TceEventPublisherPort = {
    publish: async () => {
      calls += 1;
      throw new Error('event store unavailable');
    },
  };
  await assert.doesNotReject(
    publishMonitorSnapshotBestEffort(
      publisher,
      createMonitorSnapshotEvent(input),
      error => {
        failure = error;
      }
    )
  );
  assert.equal(calls, 1);
  assert.equal(failure instanceof Error ? failure.message : '', 'event store unavailable');
});

test('best-effort publish completes normally on success', async () => {
  let calls = 0;
  const publisher: TceEventPublisherPort = {
    publish: async () => {
      calls += 1;
    },
  };
  await publishMonitorSnapshotBestEffort(publisher, createMonitorSnapshotEvent(input), () => {
    assert.fail('success must not invoke failure handler');
  });
  assert.equal(calls, 1);
});
