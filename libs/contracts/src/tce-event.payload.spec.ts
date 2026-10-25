import assert from 'node:assert/strict';
import test from 'node:test';
import { isTceRuntimeEvent } from './tce-event.contract';

const occurredAt = '2026-10-21T00:00:00.000Z';

function envelope(eventType: string, data: unknown) {
  return {
    eventId: `evt:${eventType}`,
    eventType,
    schemaVersion: 1,
    occurredAt,
    producer: 'test',
    correlationId: 'corr-1',
    accountId: 'account-1',
    data,
  };
}

const samples: Array<[string, unknown]> = [
  ['market.quote.updated', { symbol: 'DPM', price: 30000, timestamp: occurredAt, source: 'ssi' }],
  [
    'strategy.decision.created',
    {
      id: 'decision-1',
      candidateId: 'candidate-1',
      symbol: 'DPM',
      action: 'BUY',
      pool: 'A',
      slotId: 'slot-1',
      entry: 30000,
      target: 33000,
      confidence: 0.8,
      reasons: ['score passed'],
      strategyVersion: 'v1',
      decidedAt: occurredAt,
    },
  ],
  ['risk.gate.approved', { intentId: 'intent-1', riskAmount: 100, overrideApplied: false }],
  ['risk.gate.blocked', { intentId: 'intent-1', code: 'RISK_LIMIT', message: 'blocked' }],
  [
    'execution.intent.created',
    {
      id: 'intent-1',
      orderPlanId: 'plan-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      mode: 'LIVE',
      symbol: 'DPM',
      side: 'BUY',
      quantity: 100,
      limitPrice: 30000,
      lifecycleState: 'READY',
      createdAt: occurredAt,
    },
  ],
  [
    'execution.result',
    {
      ok: true,
      operation: 'SUBMIT',
      status: 'SUBMITTED',
      executionIntentId: 'intent-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      clientRequestId: 'client-1',
      providerOrderId: 'provider-1',
    },
  ],
  [
    'execution.reconciliation.required',
    { executionIntentId: 'intent-1', idempotencyKey: 'idem-1', reason: 'timeout' },
  ],
  [
    'account.snapshot.updated',
    {
      observedAt: occurredAt,
      balance: { cash: 1000, equity: 1000, withdrawable: 900, source: 'ssi' },
      positions: [{ symbol: 'DPM', quantity: 100, averagePrice: 30000, source: 'ssi' }],
      orders: [
        {
          externalId: 'provider-1',
          symbol: 'DPM',
          side: 'BUY',
          quantity: 100,
          status: 'SUBMITTED',
          source: 'ssi',
        },
      ],
    },
  ],
  [
    'monitor.snapshot.created',
    { positionId: 'position-1', symbol: 'DPM', observedAt: occurredAt, signal: 'TAKE_PROFIT' },
  ],
  [
    'dre.campaign.updated',
    {
      campaignId: 'campaign-1',
      lifecycleState: 'T+2_PENDING',
      sequence: 2,
      reason: 'purchase_recorded_settlement_pending',
    },
  ],
];

test('accepts valid payloads for every registered runtime event type', () => {
  for (const [eventType, data] of samples) {
    assert.equal(
      isTceRuntimeEvent(envelope(eventType, data)),
      true,
      `expected ${eventType} payload to validate`
    );
  }
});

test('rejects malformed event-specific payloads even when the envelope is valid', () => {
  assert.equal(
    isTceRuntimeEvent(
      envelope('market.quote.updated', {
        symbol: 'DPM',
        price: Number.NaN,
        timestamp: occurredAt,
        source: 'ssi',
      })
    ),
    false
  );
  assert.equal(
    isTceRuntimeEvent(
      envelope('monitor.snapshot.created', {
        symbol: 'DPM',
        observedAt: 'not-a-date',
      })
    ),
    false
  );
  assert.equal(
    isTceRuntimeEvent(
      envelope('execution.result', {
        ok: true,
        operation: 'SUBMIT',
        status: 'SUBMITTED',
        executionIntentId: 'intent-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
        // clientRequestId intentionally missing
      })
    ),
    false
  );
  assert.equal(isTceRuntimeEvent(envelope('unknown.event', { ok: true })), false);
  assert.equal(
    isTceRuntimeEvent(
      envelope('execution.result', {
        ok: false,
        operation: 'SUBMIT',
        status: 'REJECTED',
        executionIntentId: 'intent-1',
        correlationId: 'corr-1',
        idempotencyKey: 'idem-1',
        clientRequestId: 'client-1',
        error: {
          code: 'NOT_A_REAL_CODE',
          message: 'invalid code',
          retryable: false,
          reconciliationRequired: false,
        },
      })
    ),
    false
  );
});
