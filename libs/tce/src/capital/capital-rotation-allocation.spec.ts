import assert from 'node:assert/strict';
import test from 'node:test';
import type { TradeDecision } from '@tce/contracts';
import { createCapitalRotationAllocationService } from './capital-rotation-allocation';

const decision: TradeDecision = {
  engine: 'capital_rotation_decision',
  decision: 'BUY',
  symbol: 'DPM',
  pool: 'A',
  slot: 'A1',
  capital: 8_000_000,
  entry: 100,
  target: 105,
  confidence: 0.8,
  candidateId: 'candidate:dpm',
  decisionId: 'capital_rotation.v1:DPM:BUY:A1:candidate:dpm:2026-09-18',
  decisionWindowKey: '2026-09-18',
  strategyVersion: 'capital_rotation.v1',
  reasons: ['candidate_ranked'],
  timestamp: '2026-09-18T02:00:00.000Z',
};

test('allocation reserves a deterministic slot and is idempotent', () => {
  const service = createCapitalRotationAllocationService(
    [{ pool: 'A', capital: 8_000_000, slots: 1 }],
    '2026-09-18T02:00:00.000Z'
  );

  const first = service.reserve({ decision, timestamp: decision.timestamp });
  const second = service.reserve({ decision, timestamp: '2026-09-18T02:01:00.000Z' });

  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  if (!first.ok) return;
  assert.equal(first.allocation.slotId, 'A:1');
  assert.equal(first.allocation.state, 'RESERVED');
});

test('allocation activation and release recycle the slot', () => {
  const service = createCapitalRotationAllocationService(
    [{ pool: 'A', capital: 8_000_000, slots: 1 }],
    '2026-09-18T02:00:00.000Z'
  );

  const reserved = service.reserve({ decision, timestamp: decision.timestamp });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;

  const active = service.activate(reserved.allocation.idempotencyKey, '2026-09-18T02:01:00.000Z');
  assert.equal(active.ok, true);
  if (!active.ok) return;
  assert.equal(active.allocation.state, 'ACTIVE');

  const released = service.release(reserved.allocation.idempotencyKey, '2026-09-18T02:02:00.000Z');
  assert.equal(released.ok, true);
  if (!released.ok) return;
  assert.equal(released.allocation.state, 'RELEASED');
  assert.equal(released.snapshot.pools[0]?.availableCapital, 8_000_000);
  assert.equal(released.snapshot.slots[0]?.state, 'AVAILABLE');
});

test('allocation realization recycles principal plus pnl and records realized capital', () => {
  const service = createCapitalRotationAllocationService(
    [{ pool: 'A', capital: 8_000_000, slots: 1 }],
    '2026-09-18T02:00:00.000Z'
  );
  const reserved = service.reserve({ decision, timestamp: decision.timestamp });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const active = service.activate(reserved.allocation.idempotencyKey, '2026-09-18T02:01:00.000Z');
  assert.equal(active.ok, true);
  if (!active.ok) return;

  const realized = service.realize(
    reserved.allocation.idempotencyKey,
    '2026-09-18T02:02:00.000Z',
    250_000
  );
  assert.equal(realized.ok, true);
  if (!realized.ok) return;
  assert.equal(realized.allocation.state, 'REALIZED');
  assert.equal(realized.snapshot.pools[0]?.availableCapital, 8_250_000);
  assert.equal(realized.snapshot.pools[0]?.realizedCapital, 250_000);
  assert.equal(realized.snapshot.slots[0]?.state, 'AVAILABLE');
});
