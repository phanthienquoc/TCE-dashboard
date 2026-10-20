import { describe, expect, it, vi } from 'vitest';
import type { TceRuntimeEvent } from '@tce/contracts';
import { SupabaseRuntimeEventPublisher } from './supabase.runtime-event.publisher';

const event: TceRuntimeEvent<'monitor.snapshot.created'> = {
  eventId: 'monitor.snapshot.created:snapshot-1',
  eventType: 'monitor.snapshot.created',
  schemaVersion: 1,
  occurredAt: '2026-10-21T12:00:00.000Z',
  producer: 'tce-monitor',
  correlationId: 'monitor-run:acct-1',
  accountId: 'acct-1',
  aggregateId: 'position-1',
  data: {
    positionId: 'position-1',
    symbol: 'DPM',
    observedAt: '2026-10-21T12:00:00.000Z',
    signal: 'TAKE_PROFIT',
  },
};

describe('SupabaseRuntimeEventPublisher', () => {
  it('persists the canonical envelope into the event outbox', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as any;
    const publisher = new SupabaseRuntimeEventPublisher(db);

    await publisher.publish(event);

    expect(db.from).toHaveBeenCalledWith('tce_runtime_events');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: event.eventId,
        event_type: event.eventType,
        schema_version: event.schemaVersion,
        occurred_at: event.occurredAt,
        producer: event.producer,
        correlation_id: event.correlationId,
        account_id: event.accountId,
        aggregate_id: event.aggregateId,
        data: event.data,
      })
    );
  });

  it('treats duplicate event IDs as idempotent delivery', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505' } });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as any;
    await expect(new SupabaseRuntimeEventPublisher(db).publish(event)).resolves.toBeUndefined();
  });

  it('rejects unknown runtime event names before database access', async () => {
    const from = vi.fn();
    const publisher = new SupabaseRuntimeEventPublisher({ from } as any);
    await expect(
      publisher.publish({ ...event, eventType: 'custom.unknown' } as any)
    ).rejects.toThrow('Invalid TCE runtime event envelope');
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects malformed event-specific payloads before database access', async () => {
    const from = vi.fn();
    const publisher = new SupabaseRuntimeEventPublisher({ from } as any);
    await expect(
      publisher.publish({
        ...event,
        data: { symbol: 'DPM', observedAt: 'not-a-date' },
      } as any)
    ).rejects.toThrow('Invalid TCE runtime event envelope');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates persistence errors so callers can apply their failure policy', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '08006', message: 'offline' } });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as any;
    await expect(new SupabaseRuntimeEventPublisher(db).publish(event)).rejects.toMatchObject({
      code: '08006',
      message: 'offline',
    });
  });
});
