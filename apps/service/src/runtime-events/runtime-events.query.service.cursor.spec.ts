import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';

import { RuntimeEventsQueryService } from './runtime-events.query.service';

type QueryResult = { data: unknown; error: unknown | null };

// Minimal thenable mock for the Supabase query builder used by cursor lookup.

function makeCursorDb(result: QueryResult) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query: Record<string, any> = {};

  query.select = (columns: string) => {
    calls.push(['select', columns]);
    return query;
  };
  query.eq = (column: string, value: string) => {
    calls.push(['eq', column, value]);
    return query;
  };
  query.maybeSingle = () => {
    calls.push(['maybeSingle']);
    return query;
  };
  query.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);

  const db = {
    from: (table: string) => {
      calls.push(['from', table]);
      return query;
    },
  };

  return { db, calls };
}

test('resolves an SSE event ID to a timestamp cursor within the authenticated account', async () => {
  const occurredAt = '2026-10-21T01:00:00.000Z';
  const { db, calls } = makeCursorDb({
    data: { event_id: 'evt-1', occurred_at: occurredAt },
    error: null,
  });
  const service = new RuntimeEventsQueryService({ db } as any);

  const cursor = await service.findCursorForAccountEvent('account-1', 'evt-1');

  assert.deepEqual(cursor, { occurredAt, eventId: 'evt-1' });
  assert.deepEqual(calls, [
    ['from', 'tce_runtime_events'],
    ['select', 'event_id,occurred_at'],
    ['eq', 'account_id', 'account-1'],
    ['eq', 'event_id', 'evt-1'],
    ['maybeSingle'],
  ]);
});

test('does not resolve a cursor that is absent from the authenticated account', async () => {
  const { db } = makeCursorDb({ data: null, error: null });
  const service = new RuntimeEventsQueryService({ db } as any);

  assert.equal(await service.findCursorForAccountEvent('account-1', 'evt-other-account'), null);
});

test('rejects malformed event IDs before querying the store', async () => {
  const { db, calls } = makeCursorDb({ data: null, error: null });
  const service = new RuntimeEventsQueryService({ db } as any);

  await assert.rejects(
    service.findCursorForAccountEvent('account-1', 'bad,filter'),
    /event ID cursor is invalid/
  );
  assert.deepEqual(calls, []);
});

test('fails closed with a stable service-unavailable error when cursor lookup fails', async () => {
  const { db } = makeCursorDb({ data: null, error: { message: 'private database detail' } });
  const service = new RuntimeEventsQueryService({ db } as any);

  await assert.rejects(
    service.findCursorForAccountEvent('account-1', 'evt-1'),
    ServiceUnavailableException
  );
});
