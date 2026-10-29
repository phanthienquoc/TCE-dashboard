import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TCE_EVENT_SCHEMA_VERSION,
  isTceEventEnvelope,
  isTceRuntimeEventType,
  type TceEventEnvelope,
} from './tce-event.contract';

const validEvent = (): TceEventEnvelope<'monitor.snapshot.created', { symbol: string }> => ({
  eventId: 'evt-123',
  eventType: 'monitor.snapshot.created',
  schemaVersion: TCE_EVENT_SCHEMA_VERSION,
  occurredAt: '2026-10-20T12:00:00.000Z',
  producer: 'tce-monitor',
  correlationId: 'corr-123',
  accountId: 'account-1',
  aggregateId: 'position-1',
  sequence: 0,
  data: { symbol: 'DPM' },
});

describe('TceEventEnvelope', () => {
  it('accepts known runtime event names and rejects unknown names', () => {
    assert.equal(isTceRuntimeEventType('execution.result'), true);
    assert.equal(isTceRuntimeEventType('monitor.snapshot.created'), true);
    assert.equal(isTceRuntimeEventType('unknown.event'), false);
    assert.equal(isTceRuntimeEventType(null), false);
  });

  it('accepts a structurally valid versioned event envelope', () => {
    assert.equal(isTceEventEnvelope(validEvent()), true);
  });

  it('rejects missing event identity and trace context', () => {
    const event = validEvent();
    assert.equal(isTceEventEnvelope({ ...event, eventId: ' ' }), false);
    assert.equal(isTceEventEnvelope({ ...event, correlationId: '' }), false);
  });

  it('rejects unsupported schema versions and malformed timestamps', () => {
    const event = validEvent();
    assert.equal(isTceEventEnvelope({ ...event, schemaVersion: 2 }), false);
    assert.equal(isTceEventEnvelope({ ...event, occurredAt: 'not-a-date' }), false);
    assert.equal(isTceEventEnvelope({ ...event, occurredAt: '2026-10-20T12:00:00' }), false);
  });

  it('rejects invalid account/aggregate scope and sequence metadata', () => {
    const event = validEvent();
    assert.equal(isTceEventEnvelope({ ...event, accountId: ' ' }), false);
    assert.equal(isTceEventEnvelope({ ...event, aggregateId: '' }), false);
    assert.equal(isTceEventEnvelope({ ...event, sequence: -1 }), false);
    assert.equal(isTceEventEnvelope({ ...event, sequence: 1.5 }), false);
  });

  it('requires a data field and rejects non-object envelope values', () => {
    const event = validEvent();
    const { data: _data, ...withoutData } = event;
    assert.equal(isTceEventEnvelope(withoutData), false);
    assert.equal(isTceEventEnvelope(null), false);
    assert.equal(isTceEventEnvelope('event'), false);
  });

  it('keeps account and correlation identity stable in serialized transport payloads', () => {
    const event = validEvent();
    const decoded: unknown = JSON.parse(JSON.stringify(event));
    assert.equal(isTceEventEnvelope(decoded), true);
    if (!isTceEventEnvelope(decoded)) return;
    assert.equal(decoded.accountId, event.accountId);
    assert.equal(decoded.correlationId, event.correlationId);
    assert.equal(decoded.eventId, event.eventId);
  });
});

describe('TceRuntimeEvent payload validation', () => {
  it('rejects payloads that do not satisfy the known event schema', async () => {
    const { isTceRuntimeEvent } = await import('./tce-event.contract');
    const event = {
      eventId: 'evt-456',
      eventType: 'monitor.snapshot.created',
      schemaVersion: TCE_EVENT_SCHEMA_VERSION,
      occurredAt: '2026-10-29T03:00:00.000Z',
      producer: 'tce-monitor',
      correlationId: 'corr-456',
      accountId: 'account-1',
      aggregateId: 'position-1',
      sequence: 1,
      data: { symbol: 'DPM', observedAt: '2026-10-29T03:00:00.000Z' },
    };

    assert.equal(isTceRuntimeEvent(event), true);
    assert.equal(
      isTceRuntimeEvent({ ...event, data: { symbol: 'DPM', observedAt: 'invalid' } }),
      false
    );
    assert.equal(isTceRuntimeEvent({ ...event, eventType: 'unknown.event' }), false);
  });
});
