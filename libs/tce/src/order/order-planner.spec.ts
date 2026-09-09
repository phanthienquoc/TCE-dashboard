import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceDecision } from '@tce/contracts';
import { createExecutionIntent, planBuyOrder } from './order-planner';

const decision: TceDecision = {
  id: 'decision-1', candidateId: 'candidate-1', symbol: 'DPM', action: 'BUY', pool: 'A', slotId: 'A:1',
  entry: 28_500, target: 29_925, invalidation: 27_900, confidence: 0.9,
  reasons: ['eligible'], strategyVersion: 'hunting-dividend:v1', decidedAt: '2026-09-10T00:00:00.000Z',
};

test('rounds quantity down to the board lot and never exceeds capital', () => {
  const result = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: true,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.quantity, 300);
  assert.equal(result.plan.notional, 8_550_000);
});

test('uses the smaller buying-power limit and rejects when one board lot cannot be funded', () => {
  const result = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 1_000_000, slotAvailable: true,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.deepEqual(result, { ok: false, code: 'INSUFFICIENT_CAPITAL', message: 'Capital cannot purchase one board lot' });
});

test('rejects missing slot and non-BUY decisions before creating an order plan', () => {
  const noSlot = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: false,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.deepEqual(noSlot, { ok: false, code: 'SLOT_UNAVAILABLE', message: 'Decision slot is not available' });

  const reject = planBuyOrder({
    decision: { ...decision, action: 'REJECT' }, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: true,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.equal(reject.ok, false);
});

test('rejects invalid price and maximum constraints', () => {
  const invalid = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: true,
    price: 0, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.equal(invalid.ok, false);

  const capped = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: true,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100, maxNotional: 1_000_000 });
  assert.deepEqual(capped, { ok: false, code: 'MAX_NOTIONAL', message: 'Calculated notional exceeds maximum' });
});

test('creates a deterministic provider-neutral execution intent', () => {
  const planned = planBuyOrder({
    decision, capital: 10_000_000, availableCapital: 10_000_000, slotAvailable: true,
    price: 28_500, timestamp: '2026-09-10T00:00:01.000Z',
  }, { lotSize: 100 });
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  const intent = createExecutionIntent(planned.plan, 'ASSISTED', 'corr-1');
  assert.equal(intent.ok, true);
  if (!intent.ok) return;
  assert.equal(intent.intent.idempotencyKey, 'tce:order-plan:decision-1:A:1:BUY:300:28500');
  assert.equal(intent.intent.limitPrice, 28_500);
  assert.equal(intent.intent.lifecycleState, 'READY');
});
