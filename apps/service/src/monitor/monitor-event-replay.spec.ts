import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceEventPublisherPort } from '@tce/contracts';
import {
  publishMonitorSnapshotWithReplay,
  replayPendingMonitorSnapshotEvents,
  safeReplayErrorCode,
} from './monitor-event-replay.js';

const now = new Date('2026-10-26T04:00:00.000Z');
const row = {
  snapshot_id: 'snapshot-1',
  event_id: 'monitor.snapshot.created:snapshot-1',
  position_id: 'position-1',
  account_id: 'account-1',
  symbol: 'DPM',
  signal: 'TAKE_PROFIT',
  occurred_at: '2026-10-26T03:00:00.000Z',
  correlation_id: 'monitor-run:account-1:2026-10-26T03:00:00.000Z',
  attempt_count: 2,
};

type QueryResult = { data?: unknown; error?: unknown };
function makeDb(
  readResult: QueryResult = { data: [row], error: null },
  updateResult: QueryResult = { data: { snapshot_id: row.snapshot_id }, error: null }
) {
  const calls = {
    from: [] as string[],
    updates: [] as Record<string, unknown>[],
    filters: [] as [string, unknown][],
    orders: [] as [string, unknown][],
    limits: [] as number[],
  };
  const db = {
    from(table: string) {
      calls.from.push(table);
      let action: 'read' | 'update' = 'read';
      let currentUpdate: Record<string, unknown> | undefined;
      const builder: any = {
        select() {
          // Supabase's update(...).select(...) remains an update query.
          if (action !== 'update') action = 'read';
          return builder;
        },
        update(values: Record<string, unknown>) {
          action = 'update';
          currentUpdate = values;
          calls.updates.push(values);
          return builder;
        },
        eq(column: string, value: unknown) {
          calls.filters.push([column, value]);
          return builder;
        },
        lte(column: string, value: unknown) {
          calls.filters.push([column, value]);
          return builder;
        },
        order(column: string, options: unknown) {
          calls.orders.push([column, options]);
          return builder;
        },
        limit(value: number) {
          calls.limits.push(value);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(updateResult);
        },
        then(resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(action === 'update' ? updateResult : readResult).then(
            resolve,
            reject
          );
        },
      };
      return builder;
    },
  };
  return { db: db as any, calls };
}

function makePublisher(publish: (event: any) => Promise<void>) {
  const published: any[] = [];
  const publisher = {
    publish: async (event: any) => {
      published.push(event);
      return publish(event);
    },
  } as TceEventPublisherPort;
  return { publisher, published };
}

test('replays a due snapshot with stable event identity and marks it delivered', async () => {
  const { db, calls } = makeDb();
  const { publisher, published } = makePublisher(async () => {});
  const warnings: string[] = [];

  const result = await replayPendingMonitorSnapshotEvents(
    db,
    publisher,
    message => warnings.push(message),
    now
  );

  assert.deepEqual(result, {
    scanned: 1,
    delivered: 1,
    retried: 0,
    deadLettered: 0,
    storeUnavailable: false,
  });
  assert.equal(published[0].eventId, row.event_id);
  assert.equal(published[0].correlationId, row.correlation_id);
  assert.deepEqual(calls.updates[0], {
    state: 'delivered',
    attempt_count: 3,
    next_attempt_at: null,
    last_error_code: null,
    delivered_at: now.toISOString(),
    dead_lettered_at: null,
  });
  assert.ok(calls.filters.some(([key, value]) => key === 'attempt_count' && value === 2));
  assert.deepEqual(warnings, []);
});

test('records bounded exponential retry without persisting error messages', async () => {
  const { db, calls } = makeDb();
  const { publisher } = makePublisher(async () => {
    throw { code: '08006', message: 'never-persist-this-private-detail' };
  });
  const warnings: string[] = [];

  const result = await replayPendingMonitorSnapshotEvents(
    db,
    publisher,
    message => warnings.push(message),
    now
  );

  assert.equal(result.retried, 1);
  assert.equal(calls.updates[0].state, 'pending');
  assert.equal(calls.updates[0].attempt_count, 3);
  assert.equal(calls.updates[0].next_attempt_at, '2026-10-26T04:00:10.000Z');
  assert.equal(calls.updates[0].last_error_code, '08006');
  assert.equal(JSON.stringify(calls.updates).includes('never-persist-this-private-detail'), false);
  assert.ok(warnings.includes('monitor_event_replay_failed:08006'));
});

test('moves a repeatedly failing event to durable dead-letter state at the retry limit', async () => {
  const { db, calls } = makeDb({ data: [{ ...row, attempt_count: 7 }], error: null });
  const { publisher } = makePublisher(async () => {
    throw new Error('sensitive database details should not be persisted');
  });

  const result = await replayPendingMonitorSnapshotEvents(db, publisher, () => {}, now);

  assert.equal(result.deadLettered, 1);
  assert.equal(calls.updates[0].state, 'dead_letter');
  assert.equal(calls.updates[0].attempt_count, 8);
  assert.equal(calls.updates[0].next_attempt_at, null);
  assert.equal(calls.updates[0].last_error_code, 'Error');
  assert.equal(calls.updates[0].dead_lettered_at, now.toISOString());
  assert.equal(JSON.stringify(calls.updates).includes('sensitive database details'), false);
});

test('fails open for the monitor loop when the replay store cannot be queried', async () => {
  const { db, calls } = makeDb({
    data: null,
    error: { code: '42P01', message: 'relation missing' },
  });
  const { publisher, published } = makePublisher(async () => {});
  const warnings: string[] = [];

  const result = await replayPendingMonitorSnapshotEvents(
    db,
    publisher,
    message => warnings.push(message),
    now
  );

  assert.equal(result.storeUnavailable, true);
  assert.equal(result.scanned, 0);
  assert.equal(published.length, 0);
  assert.deepEqual(calls.updates, []);
  assert.deepEqual(warnings, ['replay_queue_unavailable:42P01']);
});

test('records an immediate monitor publish failure in the already-enqueued replay row', async () => {
  const { db, calls } = makeDb({ data: [], error: null });
  const { publisher } = makePublisher(async () => {
    throw new Error('private transport detail');
  });
  const event = {
    eventId: row.event_id,
    eventType: 'monitor.snapshot.created',
    schemaVersion: 1,
    occurredAt: row.occurred_at,
    producer: 'tce-monitor',
    correlationId: row.correlation_id,
    accountId: row.account_id,
    aggregateId: row.position_id,
    data: {
      positionId: row.position_id,
      symbol: row.symbol,
      observedAt: row.occurred_at,
      signal: row.signal,
    },
  } as any;
  const warnings: string[] = [];

  const result = await publishMonitorSnapshotWithReplay(
    db,
    publisher,
    row.snapshot_id,
    event,
    message => warnings.push(message),
    now
  );

  assert.equal(result, 'pending');
  assert.equal(calls.updates[0].state, 'pending');
  assert.equal(calls.updates[0].attempt_count, 1);
  assert.equal(calls.updates[0].next_attempt_at, '2026-10-26T04:00:05.000Z');
  assert.equal(calls.updates[0].last_error_code, 'Error');
  assert.equal(JSON.stringify(calls.updates).includes('private transport detail'), false);
});


test('dead-letters an invalid event identity without publishing it', async () => {
  const invalidRow = { ...row, event_id: 'not-the-snapshot-event' };
  const { db, calls } = makeDb({ data: [invalidRow], error: null });
  const { publisher, published } = makePublisher(async () => {});
  const result = await replayPendingMonitorSnapshotEvents(db, publisher, () => {}, now);

  assert.equal(result.scanned, 1);
  assert.equal(result.deadLettered, 1);
  assert.equal(published.length, 0);
  assert.equal(calls.updates[0].state, 'dead_letter');
  assert.equal(calls.updates[0].last_error_code, 'INVALID_REPLAY_PAYLOAD');
});

test('does not claim delivery when compare-and-set loses a concurrent state update', async () => {
  const { db, calls } = makeDb(
    { data: [row], error: null },
    { data: null, error: null }
  );
  const { publisher, published } = makePublisher(async () => {});
  const result = await replayPendingMonitorSnapshotEvents(db, publisher, () => {}, now);

  assert.equal(published.length, 1);
  assert.equal(result.scanned, 1);
  assert.equal(result.delivered, 0);
  assert.equal(result.retried, 0);
  assert.equal(result.deadLettered, 0);
  assert.equal(calls.updates.length, 1);
});

test('sanitizes error codes and never includes arbitrary messages', () => {
  assert.equal(safeReplayErrorCode({ code: '42501', message: 'private detail' }), '42501');
  assert.equal(safeReplayErrorCode(new Error('token=secret')), 'Error');
  assert.equal(safeReplayErrorCode({ code: 'not a code', message: 'private detail' }), 'PUBLISH_FAILED');
});
