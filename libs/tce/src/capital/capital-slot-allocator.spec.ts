import assert from 'node:assert/strict';
import test from 'node:test';
import { CapitalSlotAllocator, createAllocatorSnapshot } from './capital-slot-allocator';

test('allocates the lowest available slot deterministically', () => {
  const allocator = new CapitalSlotAllocator(
    createAllocatorSnapshot(
      [
        { pool: 'A', configuredCapital: 100_000, slotCount: 2 },
        { pool: 'B', configuredCapital: 50_000, slotCount: 1 },
        { pool: 'C', configuredCapital: 25_000, slotCount: 1 },
      ],
      '2026-09-09T17:00:00.000Z'
    )
  );

  const first = allocator.allocate({
    pool: 'A',
    ownerKey: 'candidate:DPM:window-1',
    amount: 40_000,
    timestamp: '2026-09-09T17:00:00.000Z',
  });
  const second = allocator.allocate({
    pool: 'A',
    ownerKey: 'candidate:PTB:window-1',
    amount: 30_000,
    timestamp: '2026-09-09T17:00:01.000Z',
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.allocation.slot.id, 'A:1');
  assert.equal(second.allocation.slot.id, 'A:2');
  assert.equal(second.allocation.pool.availableCapital, 30_000);
});

test('rejects duplicate live ownership and unavailable slots without mutating state', () => {
  const allocator = new CapitalSlotAllocator(
    createAllocatorSnapshot(
      [{ pool: 'B', configuredCapital: 20_000, slotCount: 1 }],
      '2026-09-09T17:00:00.000Z'
    )
  );
  const request = {
    pool: 'B' as const,
    ownerKey: 'candidate:SSI:window-1',
    amount: 10_000,
    timestamp: '2026-09-09T17:00:00.000Z',
  };
  assert.equal(allocator.allocate(request).ok, true);
  const before = allocator.snapshot();
  const duplicate = allocator.allocate({ ...request, timestamp: '2026-09-09T17:01:00.000Z' });
  assert.deepEqual(duplicate, {
    ok: false,
    code: 'OWNER_ALREADY_ASSIGNED',
    message: 'Owner candidate:SSI:window-1 already owns slot B:1',
  });
  assert.deepEqual(allocator.snapshot(), before);
  assert.equal(
    allocator.allocate({
      pool: 'B',
      ownerKey: 'candidate:OTHER:window-1',
      amount: 5_000,
      timestamp: request.timestamp,
    }).ok,
    false
  );
});

test('activation and release recycle the same slot and restore pool capital', () => {
  const allocator = new CapitalSlotAllocator(
    createAllocatorSnapshot(
      [{ pool: 'C', configuredCapital: 30_000, slotCount: 1 }],
      '2026-09-09T17:00:00.000Z'
    )
  );
  const allocation = allocator.allocate({
    pool: 'C',
    ownerKey: 'candidate:VIC:window-1',
    amount: 12_000,
    timestamp: '2026-09-09T17:00:00.000Z',
  });
  assert.equal(allocation.ok, true);
  if (!allocation.ok) return;

  const active = allocator.activate(allocation.allocation.slot.id, '2026-09-09T17:00:01.000Z');
  assert.equal(active.ok, true);
  const released = allocator.release('candidate:VIC:window-1', '2026-09-09T17:00:02.000Z');
  assert.equal(released.ok, true);
  if (!released.ok) return;
  assert.equal(released.allocation.slot.state, 'AVAILABLE');
  assert.equal(released.allocation.pool.availableCapital, 30_000);

  const recycled = allocator.allocate({
    pool: 'C',
    ownerKey: 'candidate:FPT:window-2',
    amount: 8_000,
    timestamp: '2026-09-09T17:00:03.000Z',
  });
  assert.equal(recycled.ok, true);
  if (!recycled.ok) return;
  assert.equal(recycled.allocation.slot.id, 'C:1');
});

test('keeps the temporary default pool capital split equal across A/B/C', () => {
  const totalCapital = 9_000_000;
  const equalPoolCapital = totalCapital / 3;
  const allocator = new CapitalSlotAllocator(
    createAllocatorSnapshot(
      [
        { pool: 'A', configuredCapital: equalPoolCapital, slotCount: 1 },
        { pool: 'B', configuredCapital: equalPoolCapital, slotCount: 1 },
        { pool: 'C', configuredCapital: equalPoolCapital, slotCount: 1 },
      ],
      '2026-09-10T00:00:00.000Z'
    )
  );

  const snapshot = allocator.snapshot();
  assert.deepEqual(
    snapshot.pools.map(pool => pool.configuredCapital),
    [3_000_000, 3_000_000, 3_000_000]
  );
  assert.equal(
    snapshot.pools.reduce((sum, pool) => sum + pool.configuredCapital, 0),
    totalCapital
  );
});
