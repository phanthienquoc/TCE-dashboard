import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { RuntimeEventsQueryService } from './runtime-events.query.service';

function makeDb(result: { data: unknown[] | null; error: unknown | null }) {
  const query: Record<string, any> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'gt']) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return { db: { from: vi.fn(() => query) }, query };
}

describe('RuntimeEventsQueryService', () => {
  it('scopes every query to the authenticated account and validates returned envelopes', async () => {
    const event = {
      event_id: 'evt-1',
      event_type: 'monitor.snapshot.created',
      schema_version: 1,
      occurred_at: '2026-10-21T01:00:00.000Z',
      producer: 'tce-monitor',
      correlation_id: 'monitor-run:account-1',
      account_id: 'account-1',
      aggregate_id: 'position-1',
      sequence: null,
      data: { symbol: 'DPM', observedAt: '2026-10-21T01:00:00.000Z' },
    };
    const { db, query } = makeDb({
      data: [event, { ...event, event_id: 'bad', event_type: 'unknown.event' }],
      error: null,
    });
    const service = new RuntimeEventsQueryService(db as any);

    const result = await service.listForAccount('account-1', { limit: 25 });

    expect(db.from).toHaveBeenCalledWith('tce_runtime_events');
    expect(query.eq).toHaveBeenCalledWith('account_id', 'account-1');
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(result).toEqual([
      {
        eventId: 'evt-1',
        eventType: 'monitor.snapshot.created',
        schemaVersion: 1,
        occurredAt: event.occurred_at,
        producer: 'tce-monitor',
        correlationId: event.correlation_id,
        accountId: 'account-1',
        aggregateId: 'position-1',
        data: event.data,
      },
    ]);
  });

  it('rejects malformed cursors before querying the database', async () => {
    const { db } = makeDb({ data: [], error: null });
    const service = new RuntimeEventsQueryService(db as any);
    await expect(service.listForAccount('account-1', { after: 'not-a-date' })).rejects.toThrow(
      'The after cursor must be an ISO-8601 timestamp'
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it('fails closed with a stable service-unavailable error when the store is unavailable', async () => {
    const { db } = makeDb({ data: null, error: { message: 'relation missing' } });
    const service = new RuntimeEventsQueryService(db as any);
    await expect(service.listForAccount('account-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
