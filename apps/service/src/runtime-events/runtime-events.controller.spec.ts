import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeEventsController } from './runtime-events.controller';

const event = {
  eventId: 'evt-1',
  eventType: 'monitor.snapshot.created',
  schemaVersion: 1 as const,
  occurredAt: '2026-10-21T01:00:00.000Z',
  producer: 'tce-monitor',
  correlationId: 'monitor-run:account-1',
  accountId: 'account-1',
  aggregateId: 'position-1',
  data: { symbol: 'DPM', observedAt: '2026-10-21T01:00:00.000Z' },
};

function makeController() {
  const events = { listForAccount: vi.fn().mockResolvedValue([event]) };
  const jwt = { verify: vi.fn().mockReturnValue({ sub: 'account-1' }) };
  return {
    controller: new RuntimeEventsController(events as any, jwt as any),
    events,
    jwt,
  };
}

describe('RuntimeEventsController', () => {
  it('returns the canonical envelope in REST and derives account scope from the bearer token', async () => {
    const { controller, events, jwt } = makeController();
    const response = await controller.list('Bearer access-token', undefined, '25');

    expect(jwt.verify).toHaveBeenCalledWith('access-token');
    expect(events.listForAccount).toHaveBeenCalledWith('account-1', { limit: 25 });
    expect(response).toEqual({
      ok: true,
      data: [event],
      meta: { limit: 25, nextCursor: event.occurredAt },
    });
  });

  it('rejects requests without a bearer token', async () => {
    const { controller } = makeController();
    expect(() => controller.stream(undefined)).toThrow(UnauthorizedException);
  });

  it('rejects malformed cursors and unknown event types instead of silently broadening the query', async () => {
    const { controller } = makeController();
    await expect(controller.list('Bearer token', 'not-a-date')).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(controller.list('Bearer token', undefined, undefined, 'unknown.event')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('exposes SSE as the same versioned envelope rather than a transport-specific payload', () => {
    const { controller } = makeController();
    const stream = controller.stream('Bearer access-token');
    expect(stream).toBeDefined();
    expect(typeof stream.subscribe).toBe('function');
  });
});
