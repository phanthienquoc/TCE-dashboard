import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateSlot,
  createCapitalPoolState,
  createSlot,
  isCapitalPoolStateValid,
  markSlotOrphaned,
  markSlotStuck,
  releaseReservedCapital,
  releaseSlot,
  reserveCapital,
  reserveSlot,
} from './capital-allocation.contract';

test('reserves capital without exceeding available pool capacity', () => {
  const pool = createCapitalPoolState('A', 100_000, 2);
  const slot = createSlot('A', 0, '2026-09-09T16:00:00.000Z');
  const reservedSlot = reserveSlot(
    slot,
    'candidate:DPM:window-1',
    40_000,
    '2026-09-09T16:00:00.000Z'
  );
  const outcome = reserveCapital(
    pool,
    {
      pool: 'A',
      slotId: reservedSlot.id,
      ownerKey: reservedSlot.ownerKey!,
      amount: 40_000,
      timestamp: reservedSlot.updatedAt,
    },
    reservedSlot
  );

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.state.availableCapital, 60_000);
  assert.equal(outcome.state.allocatedCapital, 40_000);
  assert.equal(outcome.state.reservedCapital, 40_000);
  assert.equal(isCapitalPoolStateValid(outcome.state), true);
});

test('rejects duplicate owner and over-allocation deterministically', () => {
  const pool = createCapitalPoolState('B', 50_000, 1);
  const slot = createSlot('B', 0, '2026-09-09T16:00:00.000Z');
  const request = {
    pool: 'B' as const,
    slotId: slot.id,
    ownerKey: 'candidate:FPT:window-1',
    amount: 60_000,
    timestamp: slot.updatedAt,
  };
  assert.equal(reserveCapital(pool, request, slot).ok, false);
  assert.equal(
    reserveCapital(pool, { ...request, amount: 10_000 }, slot, new Set([request.ownerKey])).ok,
    false
  );
});

test('slot lifecycle supports reserve, activate and release', () => {
  const timestamp = '2026-09-09T16:00:00.000Z';
  const slot = createSlot('C', 1, timestamp);
  const reserved = reserveSlot(slot, 'candidate:VIC:window-1', 20_000, timestamp);
  const active = activateSlot(reserved, timestamp);
  const released = releaseSlot(active, timestamp);

  assert.equal(reserved.state, 'RESERVED');
  assert.equal(active.state, 'ACTIVE');
  assert.equal(released.state, 'AVAILABLE');
  assert.equal(released.ownerKey, undefined);
  assert.equal(released.reservedCapital, 0);
});

test('orphaned and stuck states remain explicit recovery states', () => {
  const timestamp = '2026-09-09T16:00:00.000Z';
  const slot = createSlot('A', 0, timestamp);
  assert.equal(markSlotOrphaned(slot, timestamp).state, 'ORPHANED');
  assert.equal(markSlotStuck(slot, timestamp).state, 'STUCK');
});

test('releasing reserved capital restores availability', () => {
  const pool = createCapitalPoolState('A', 100_000, 2);
  const slot = createSlot('A', 0, '2026-09-09T16:00:00.000Z');
  const outcome = reserveCapital(
    pool,
    {
      pool: 'A',
      slotId: slot.id,
      ownerKey: 'candidate:DPM:window-1',
      amount: 25_000,
      timestamp: slot.updatedAt,
    },
    slot
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  const released = releaseReservedCapital(outcome.state, 25_000);
  assert.deepEqual(released, pool);
});
