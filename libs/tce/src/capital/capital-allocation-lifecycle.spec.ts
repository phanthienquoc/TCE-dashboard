import assert from 'node:assert/strict';
import test from 'node:test';
import type { CapitalAllocationLifecycle } from '@tce/contracts';
import { CapitalAllocationLifecycleService } from './capital-allocation-lifecycle';

test('partial fill releases only unfilled capital and preserves filled allocation', () => {
  const service = new CapitalAllocationLifecycleService({
    ownerKey: 'candidate:DPM:window-1',
    pool: {
      pool: 'A', configuredCapital: 100, allocatedCapital: 100, reservedCapital: 100,
      availableCapital: 0, realizedCapital: 0, slotCount: 1,
    },
    slot: {
      id: 'A:1', pool: 'A', index: 0, state: 'RESERVED', ownerKey: 'candidate:DPM:window-1',
      reservedCapital: 100, updatedAt: '2026-09-10T00:00:00.000Z',
    },
    allocatedAmount: 100,
    reservedAmount: 100,
    filledAmount: 0,
    state: 'RESERVED',
    updatedAt: '2026-09-10T00:00:00.000Z',
  } satisfies CapitalAllocationLifecycle);

  const partial = service.partialFill({ idempotencyKey: 'fill-1', timestamp: '2026-09-10T00:00:01.000Z' }, 40);
  assert.equal(partial.ok, true);
  if (!partial.ok) return;
  assert.equal(partial.lifecycle.filledAmount, 40);
  assert.equal(partial.lifecycle.reservedAmount, 60);
  assert.equal(partial.lifecycle.pool.allocatedCapital, 100);
  assert.equal(partial.lifecycle.pool.reservedCapital, 60);
  assert.equal(partial.lifecycle.slot.reservedCapital, 60);

  const release = service.release({ idempotencyKey: 'cancel-1', timestamp: '2026-09-10T00:00:02.000Z' });
  assert.equal(release.ok, true);
  if (!release.ok) return;
  assert.equal(release.lifecycle.allocatedAmount, 40);
  assert.equal(release.lifecycle.reservedAmount, 0);
  assert.equal(release.lifecycle.pool.allocatedCapital, 40);
  assert.equal(release.lifecycle.pool.reservedCapital, 0);
  assert.equal(release.lifecycle.pool.availableCapital, 60);
  assert.equal(release.lifecycle.slot.state, 'ACTIVE');
});

test('close realizes pnl only after all reserved capital has been released', () => {
  const service = new CapitalAllocationLifecycleService({
    ownerKey: 'candidate:PTB:window-1',
    pool: {
      pool: 'B', configuredCapital: 100, allocatedCapital: 50, reservedCapital: 0,
      availableCapital: 50, realizedCapital: 0, slotCount: 1,
    },
    slot: {
      id: 'B:1', pool: 'B', index: 0, state: 'ACTIVE', ownerKey: 'candidate:PTB:window-1',
      reservedCapital: 0, updatedAt: '2026-09-10T00:00:00.000Z',
    },
    allocatedAmount: 50,
    reservedAmount: 0,
    filledAmount: 50,
    state: 'ACTIVE',
    updatedAt: '2026-09-10T00:00:00.000Z',
  });

  const closed = service.close({ idempotencyKey: 'close-1', timestamp: '2026-09-10T00:00:01.000Z' }, 5);
  assert.equal(closed.ok, true);
  if (!closed.ok) return;
  assert.equal(closed.lifecycle.state, 'REALIZED');
  assert.equal(closed.lifecycle.pool.allocatedCapital, 0);
  assert.equal(closed.lifecycle.pool.availableCapital, 105);
  assert.equal(closed.lifecycle.pool.realizedCapital, 5);
  assert.equal(closed.lifecycle.slot.state, 'AVAILABLE');
  assert.equal(closed.lifecycle.slot.ownerKey, undefined);
});

test('idempotency returns the original lifecycle and does not apply a command twice', () => {
  const service = new CapitalAllocationLifecycleService({
    ownerKey: 'candidate:VIC:window-1',
    pool: {
      pool: 'C', configuredCapital: 100, allocatedCapital: 100, reservedCapital: 100,
      availableCapital: 0, realizedCapital: 0, slotCount: 1,
    },
    slot: {
      id: 'C:1', pool: 'C', index: 0, state: 'RESERVED', ownerKey: 'candidate:VIC:window-1',
      reservedCapital: 100, updatedAt: '2026-09-10T00:00:00.000Z',
    },
    allocatedAmount: 100,
    reservedAmount: 100,
    filledAmount: 0,
    state: 'RESERVED',
    updatedAt: '2026-09-10T00:00:00.000Z',
  });

  const first = service.partialFill({ idempotencyKey: 'same-key', timestamp: '2026-09-10T00:00:01.000Z' }, 25);
  const second = service.partialFill({ idempotencyKey: 'same-key', timestamp: '2026-09-10T00:01:00.000Z' }, 90);
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(service.snapshot().filledAmount, 25);
});

test('orphan and stuck are explicit recovery states', () => {
  const service = new CapitalAllocationLifecycleService({
    ownerKey: 'candidate:FPT:window-1',
    pool: {
      pool: 'A', configuredCapital: 100, allocatedCapital: 20, reservedCapital: 0,
      availableCapital: 80, realizedCapital: 0, slotCount: 1,
    },
    slot: {
      id: 'A:1', pool: 'A', index: 0, state: 'ACTIVE', ownerKey: 'candidate:FPT:window-1',
      reservedCapital: 0, updatedAt: '2026-09-10T00:00:00.000Z',
    },
    allocatedAmount: 20,
    reservedAmount: 0,
    filledAmount: 20,
    state: 'ACTIVE',
    updatedAt: '2026-09-10T00:00:00.000Z',
  });

  const orphan = service.orphan({ idempotencyKey: 'orphan-1', timestamp: '2026-09-10T00:00:01.000Z' });
  assert.equal(orphan.ok, true);
  if (!orphan.ok) return;
  assert.equal(orphan.lifecycle.state, 'ORPHANED');

  const stuck = service.stuck({ idempotencyKey: 'stuck-1', timestamp: '2026-09-10T00:00:02.000Z' });
  assert.equal(stuck.ok, true);
  if (!stuck.ok) return;
  assert.equal(stuck.lifecycle.state, 'STUCK');
});
