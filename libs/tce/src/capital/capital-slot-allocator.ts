import type { CapitalPoolId } from '@tce/contracts';
import {
  activateSlot,
  createSlot,
  releaseReservedCapital,
  releaseSlot,
  reserveCapital,
  reserveSlot,
  type CapitalAllocationResult,
  type CapitalPoolState,
  type CapitalSlot,
} from '@tce/contracts';

export type CapitalSlotAllocation = Readonly<{
  pool: CapitalPoolState;
  slot: CapitalSlot;
  allocation: CapitalAllocationResult;
}>;

export type CapitalSlotAllocatorRequest = Readonly<{
  pool: CapitalPoolId;
  ownerKey: string;
  amount: number;
  timestamp: string;
}>;

export type CapitalSlotAllocatorFailure = Readonly<{
  ok: false;
  code: string;
  message: string;
}>;

export type CapitalSlotAllocatorSuccess = Readonly<{
  ok: true;
  allocation: CapitalSlotAllocation;
}>;

export type CapitalSlotAllocatorOutcome = CapitalSlotAllocatorSuccess | CapitalSlotAllocatorFailure;

export interface CapitalPoolRepository {
  get(pool: CapitalPoolId): CapitalPoolState | undefined;
  save(state: CapitalPoolState): void;
}

export interface CapitalSlotRepository {
  list(pool: CapitalPoolId): readonly CapitalSlot[];
  save(slot: CapitalSlot): void;
}

export type CapitalSlotAllocatorSnapshot = Readonly<{
  pools: readonly CapitalPoolState[];
  slots: readonly CapitalSlot[];
}>;

export class CapitalSlotAllocator {
  private readonly pools = new Map<CapitalPoolId, CapitalPoolState>();
  private readonly slots = new Map<string, CapitalSlot>();

  constructor(snapshot: CapitalSlotAllocatorSnapshot) {
    for (const pool of snapshot.pools) this.pools.set(pool.pool, pool);
    for (const slot of snapshot.slots) this.slots.set(slot.id, slot);
  }

  allocate(request: CapitalSlotAllocatorRequest): CapitalSlotAllocatorOutcome {
    const pool = this.pools.get(request.pool);
    if (!pool)
      return { ok: false, code: 'POOL_NOT_FOUND', message: `Capital pool ${request.pool} was not found` };
    if (!request.ownerKey.trim())
      return { ok: false, code: 'INVALID_OWNER', message: 'ownerKey is required' };

    const existingOwner = [...this.slots.values()].find(
      slot =>
        slot.pool === request.pool &&
        slot.ownerKey === request.ownerKey &&
        (slot.state === 'RESERVED' || slot.state === 'ACTIVE')
    );
    if (existingOwner)
      return {
        ok: false,
        code: 'OWNER_ALREADY_ASSIGNED',
        message: `Owner ${request.ownerKey} already owns slot ${existingOwner.id}`,
      };

    const slot = [...this.slots.values()]
      .filter(candidate => candidate.pool === request.pool && candidate.state === 'AVAILABLE')
      .sort((a, b) => a.index - b.index || a.id.localeCompare(b.id))[0];
    if (!slot)
      return {
        ok: false,
        code: 'SLOT_UNAVAILABLE',
        message: `No available slot exists in pool ${request.pool}`,
      };

    const reserved = reserveCapital(
      pool,
      {
        pool: request.pool,
        slotId: slot.id,
        ownerKey: request.ownerKey,
        amount: request.amount,
        timestamp: request.timestamp,
      },
      slot,
      new Set([...this.slots.values()].filter(item => item.ownerKey).map(item => item.ownerKey!))
    );
    if (!reserved.ok) {
      return { ok: false, code: reserved.error.code, message: reserved.error.message };
    }

    const nextSlot = reserveSlot(slot, request.ownerKey, request.amount, request.timestamp);
    this.pools.set(request.pool, reserved.state);
    this.slots.set(slot.id, nextSlot);

    return {
      ok: true,
      allocation: { pool: reserved.state, slot: nextSlot, allocation: reserved.result },
    };
  }

  activate(slotId: string, timestamp: string): CapitalSlotAllocatorOutcome {
    const slot = this.slots.get(slotId);
    if (!slot)
      return { ok: false, code: 'SLOT_NOT_FOUND', message: `Slot ${slotId} was not found` };
    const pool = this.pools.get(slot.pool);
    if (!pool)
      return { ok: false, code: 'POOL_NOT_FOUND', message: `Capital pool ${slot.pool} was not found` };
    const active = activateSlot(slot, timestamp);
    this.slots.set(slotId, active);
    return {
      ok: true,
      allocation: {
        pool,
        slot: active,
        allocation: {
          pool: pool.pool,
          slotId: active.id,
          ownerKey: active.ownerKey!,
          amount: active.reservedCapital,
          allocationKey: `${pool.pool}:${active.id}:${active.ownerKey}`,
        },
      },
    };
  }

  release(ownerKey: string, timestamp: string): CapitalSlotAllocatorOutcome {
    const slot = [...this.slots.values()].find(
      candidate =>
        candidate.ownerKey === ownerKey &&
        (candidate.state === 'RESERVED' || candidate.state === 'ACTIVE')
    );
    if (!slot)
      return { ok: false, code: 'ALLOCATION_NOT_FOUND', message: `No active allocation exists for ${ownerKey}` };
    const pool = this.pools.get(slot.pool);
    if (!pool)
      return { ok: false, code: 'POOL_NOT_FOUND', message: `Capital pool ${slot.pool} was not found` };

    const releasedPool = releaseReservedCapital(pool, slot.reservedCapital);
    const releasedSlot = releaseSlot(slot, timestamp);
    this.pools.set(pool.pool, releasedPool);
    this.slots.set(slot.id, releasedSlot);
    return {
      ok: true,
      allocation: {
        pool: releasedPool,
        slot: releasedSlot,
        allocation: {
          pool: releasedPool.pool,
          slotId: releasedSlot.id,
          ownerKey,
          amount: slot.reservedCapital,
          allocationKey: `${releasedPool.pool}:${releasedSlot.id}:${ownerKey}`,
        },
      },
    };
  }

  snapshot(): CapitalSlotAllocatorSnapshot {
    return {
      pools: [...this.pools.values()].sort((a, b) => a.pool.localeCompare(b.pool)),
      slots: [...this.slots.values()].sort(
        (a, b) => a.pool.localeCompare(b.pool) || a.index - b.index
      ),
    };
  }
}

export function createAllocatorSnapshot(
  pools: ReadonlyArray<
    Readonly<{ pool: CapitalPoolId; configuredCapital: number; slotCount: number }>
  >,
  timestamp: string
): CapitalSlotAllocatorSnapshot {
  const states = pools.map(config => ({
    pool: config.pool,
    configuredCapital: config.configuredCapital,
    allocatedCapital: 0,
    reservedCapital: 0,
    availableCapital: config.configuredCapital,
    realizedCapital: 0,
    slotCount: config.slotCount,
  }));
  return {
    pools: states,
    slots: states.flatMap(pool =>
      Array.from({ length: pool.slotCount }, (_, index) => createSlot(pool.pool, index, timestamp))
    ),
  };
}
