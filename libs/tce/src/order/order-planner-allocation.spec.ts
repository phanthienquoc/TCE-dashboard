import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceDecision } from '@tce/contracts';
import { CapitalSlotAllocator, createAllocatorSnapshot } from '../capital/capital-slot-allocator';
import { allocateAndPlanBuyOrder } from './order-planner-allocation';

const decision: TceDecision = {
  id: 'decision-1',
  candidateId: 'candidate-1',
  symbol: 'DPM',
  action: 'BUY',
  pool: 'A',
  slotId: 'A:1',
  entry: 28_500,
  target: 29_925,
  invalidation: 27_900,
  confidence: 0.9,
  reasons: ['eligible'],
  strategyVersion: 'hunting-dividend:v1',
  decidedAt: '2026-09-10T00:00:00.000Z',
};

function allocator() {
  return new CapitalSlotAllocator(
    createAllocatorSnapshot(
      [
        { pool: 'A', configuredCapital: 10_000_000, slotCount: 2 },
        { pool: 'B', configuredCapital: 5_000_000, slotCount: 1 },
        { pool: 'C', configuredCapital: 2_000_000, slotCount: 1 },
      ],
      '2026-09-10T00:00:00.000Z'
    )
  );
}

test('reserves the selected pool and deterministic slot before producing a plan', () => {
  const a = allocator();
  const result = allocateAndPlanBuyOrder(
    a,
    decision,
    { lotSize: 100 },
    5_000_000,
    '2026-09-10T00:00:01.000Z'
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.plan.slotId, 'A:1');
  assert.equal(result.plan.pool, 'A');
  assert.equal(result.plan.quantity, 100);
  assert.equal(result.plan.notional, 2_850_000);
  assert.equal(result.allocation.allocation.slot.id, 'A:1');
  assert.equal(result.allocation.allocation.slot.state, 'RESERVED');
});

test('does not leak reservation when planning cannot buy one lot', () => {
  const a = allocator();
  const result = allocateAndPlanBuyOrder(
    a,
    decision,
    { lotSize: 100 },
    10_000,
    '2026-09-10T00:00:01.000Z'
  );
  assert.deepEqual(result, {
    ok: false,
    code: 'INSUFFICIENT_CAPITAL',
    message: 'Capital cannot purchase one board lot',
  });
  const snapshot = a.snapshot();
  assert.equal(snapshot.pools[0].allocatedCapital, 0);
  assert.equal(snapshot.pools[0].reservedCapital, 0);
  assert.equal(snapshot.pools[0].availableCapital, 10_000_000);
  assert.equal(snapshot.slots[0].state, 'AVAILABLE');
});

test('allocator prevents planner from exceeding the pool reservation', () => {
  const a = allocator();
  const first = allocateAndPlanBuyOrder(
    a,
    decision,
    { lotSize: 100 },
    6_000_000,
    '2026-09-10T00:00:01.000Z'
  );
  assert.equal(first.ok, true);
  const second = allocateAndPlanBuyOrder(
    a,
    { ...decision, id: 'decision-2', candidateId: 'candidate-2', slotId: 'A:2' },
    { lotSize: 100 },
    6_000_000,
    '2026-09-10T00:00:02.000Z'
  );
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.code, 'INSUFFICIENT_AVAILABLE_CAPITAL');
});
