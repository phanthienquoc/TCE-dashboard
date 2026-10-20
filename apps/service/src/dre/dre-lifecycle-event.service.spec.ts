import { describe, expect, it, vi } from 'vitest';
import { createDreLifecycleEvent, DreLifecycleEventService } from './dre-lifecycle-event.service';

const input = {
  campaignId: 'campaign-1',
  lifecycleState: 'T+2_PENDING',
  aggregateId: 'position-1',
  sequence: 2,
  reason: 'purchase_recorded_settlement_pending',
  occurredAt: '2026-10-21T02:00:00.000Z',
  eventKey: 'position-1:T+2_PENDING:entry-1',
};

describe('DreLifecycleEventService', () => {
  it('creates a versioned campaign event with stable identity and lifecycle scope', () => {
    const event = createDreLifecycleEvent(input);
    expect(event).toEqual({
      eventId: 'dre.campaign.updated:campaign-1:position-1:T+2_PENDING:entry-1',
      eventType: 'dre.campaign.updated',
      schemaVersion: 1,
      occurredAt: input.occurredAt,
      producer: 'dre',
      correlationId: 'dre:campaign-1',
      aggregateId: 'position-1',
      sequence: 2,
      data: {
        campaignId: 'campaign-1',
        lifecycleState: 'T+2_PENDING',
        sequence: 2,
        reason: 'purchase_recorded_settlement_pending',
      },
    });
    expect(createDreLifecycleEvent(input).eventId).toBe(event.eventId);
  });

  it('rejects malformed timestamps and sequence values before publishing', () => {
    expect(() => createDreLifecycleEvent({ ...input, occurredAt: 'bad' })).toThrow(
      'DRE event occurredAt must be a valid timestamp'
    );
    expect(() => createDreLifecycleEvent({ ...input, sequence: -1 })).toThrow(
      'DRE event sequence must be a non-negative safe integer'
    );
  });

  it('publishes the canonical event without letting publisher failure interrupt DRE state flow', async () => {
    const publisher = { publish: vi.fn().mockRejectedValue(new Error('event store offline')) };
    const service = new DreLifecycleEventService(publisher as any);

    await expect(service.publish(input)).resolves.toBeUndefined();
    expect(publisher.publish).toHaveBeenCalledWith(createDreLifecycleEvent(input));
  });

  it('swallows malformed event metadata after a state transition so event telemetry cannot break DRE', async () => {
    const publisher = { publish: vi.fn() };
    const service = new DreLifecycleEventService(publisher as any);

    await expect(service.publish({ ...input, occurredAt: 'invalid' })).resolves.toBeUndefined();
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
