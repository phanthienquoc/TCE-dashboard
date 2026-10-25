import type { CapitalPoolId } from './decision-engine';

export const CAPITAL_POOL_IDS: readonly CapitalPoolId[] = ['A', 'B', 'C'];

export type CapitalPoolState = Readonly<{
  pool: CapitalPoolId;
  configuredCapital: number;
  allocatedCapital: number;
  reservedCapital: number;
  availableCapital: number;
  realizedCapital: number;
  slotCount: number;
}>;

export type SlotState = 'AVAILABLE' | 'RESERVED' | 'ACTIVE' | 'ORPHANED' | 'STUCK';

export type CapitalSlot = Readonly<{
  id: string;
  pool: CapitalPoolId;
  index: number;
  state: SlotState;
  ownerKey?: string;
  reservedCapital: number;
  updatedAt: string;
}>;

export type CapitalAllocationRequest = Readonly<{
  pool: CapitalPoolId;
  slotId: string;
  ownerKey: string;
  amount: number;
  timestamp: string;
}>;

export type CapitalAllocationResult = Readonly<{
  pool: CapitalPoolId;
  slotId: string;
  ownerKey: string;
  amount: number;
  allocationKey: string;
}>;

export type CapitalAllocationErrorCode =
  | 'INVALID_AMOUNT'
  | 'INSUFFICIENT_AVAILABLE_CAPITAL'
  | 'SLOT_UNAVAILABLE'
  | 'OWNER_ALREADY_ASSIGNED'
  | 'INVALID_POOL_STATE'
  | 'INVALID_SLOT_STATE';

export type CapitalAllocationError = Readonly<{
  code: CapitalAllocationErrorCode;
  message: string;
}>;

export type CapitalAllocationOutcome =
  | Readonly<{ ok: true; state: CapitalPoolState; result: CapitalAllocationResult }>
  | Readonly<{ ok: false; error: CapitalAllocationError }>;

export function createCapitalPoolState(
  pool: CapitalPoolId,
  configuredCapital: number,
  slotCount: number
): CapitalPoolState {
  if (!Number.isFinite(configuredCapital) || configuredCapital < 0) {
    throw new Error('configuredCapital must be a finite non-negative number');
  }
  if (!Number.isInteger(slotCount) || slotCount < 0) {
    throw new Error('slotCount must be a non-negative integer');
  }
  return {
    pool,
    configuredCapital,
    allocatedCapital: 0,
    reservedCapital: 0,
    availableCapital: configuredCapital,
    realizedCapital: 0,
    slotCount,
  };
}

export function reserveCapital(
  state: CapitalPoolState,
  request: CapitalAllocationRequest,
  slot: CapitalSlot,
  existingOwnerKeys: ReadonlySet<string> = new Set()
): CapitalAllocationOutcome {
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    return {
      ok: false,
      error: { code: 'INVALID_AMOUNT', message: 'Allocation amount must be positive and finite' },
    };
  }
  if (request.pool !== state.pool || slot.pool !== state.pool) {
    return {
      ok: false,
      error: {
        code: 'INVALID_POOL_STATE',
        message: 'Pool and slot must belong to the same capital pool',
      },
    };
  }
  if (slot.state !== 'AVAILABLE') {
    return {
      ok: false,
      error: { code: 'SLOT_UNAVAILABLE', message: `Slot ${slot.id} is not available` },
    };
  }
  if (existingOwnerKeys.has(request.ownerKey)) {
    return {
      ok: false,
      error: {
        code: 'OWNER_ALREADY_ASSIGNED',
        message: `Owner ${request.ownerKey} already has an allocation`,
      },
    };
  }
  if (request.amount > state.availableCapital) {
    return {
      ok: false,
      error: {
        code: 'INSUFFICIENT_AVAILABLE_CAPITAL',
        message: 'Requested capital exceeds available pool capital',
      },
    };
  }

  const next: CapitalPoolState = {
    ...state,
    allocatedCapital: state.allocatedCapital + request.amount,
    reservedCapital: state.reservedCapital + request.amount,
    availableCapital: state.availableCapital - request.amount,
  };
  return {
    ok: true,
    state: next,
    result: {
      pool: state.pool,
      slotId: request.slotId,
      ownerKey: request.ownerKey,
      amount: request.amount,
      allocationKey: `${request.pool}:${request.slotId}:${request.ownerKey}`,
    },
  };
}

export function releaseReservedCapital(state: CapitalPoolState, amount: number): CapitalPoolState {
  if (!Number.isFinite(amount) || amount < 0 || amount > state.reservedCapital) {
    throw new Error('release amount must be within reserved capital');
  }
  return {
    ...state,
    reservedCapital: state.reservedCapital - amount,
    allocatedCapital: state.allocatedCapital - amount,
    availableCapital: state.availableCapital + amount,
  };
}

export function realizeCapital(
  state: CapitalPoolState,
  principal: number,
  pnl: number
): CapitalPoolState {
  if (!Number.isFinite(principal) || principal < 0 || principal > state.allocatedCapital) {
    throw new Error('principal must be within allocated capital');
  }
  if (!Number.isFinite(pnl)) throw new Error('pnl must be finite');
  return {
    ...state,
    allocatedCapital: state.allocatedCapital - principal,
    availableCapital: state.availableCapital + principal + pnl,
    realizedCapital: state.realizedCapital + pnl,
  };
}

export function createSlot(pool: CapitalPoolId, index: number, timestamp: string): CapitalSlot {
  if (!Number.isInteger(index) || index < 0)
    throw new Error('slot index must be a non-negative integer');
  return {
    id: `${pool}:${index + 1}`,
    pool,
    index,
    state: 'AVAILABLE',
    reservedCapital: 0,
    updatedAt: timestamp,
  };
}

export function reserveSlot(
  slot: CapitalSlot,
  ownerKey: string,
  amount: number,
  timestamp: string
): CapitalSlot {
  if (slot.state !== 'AVAILABLE') throw new Error(`Slot ${slot.id} is not available`);
  if (!ownerKey.trim()) throw new Error('ownerKey is required');
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error('reserved slot capital must be positive and finite');
  return { ...slot, state: 'RESERVED', ownerKey, reservedCapital: amount, updatedAt: timestamp };
}

export function activateSlot(slot: CapitalSlot, timestamp: string): CapitalSlot {
  if (slot.state !== 'RESERVED')
    throw new Error(`Slot ${slot.id} must be RESERVED before activation`);
  return { ...slot, state: 'ACTIVE', updatedAt: timestamp };
}

export function releaseSlot(slot: CapitalSlot, timestamp: string): CapitalSlot {
  if (slot.state !== 'RESERVED' && slot.state !== 'ACTIVE') {
    throw new Error(`Slot ${slot.id} cannot be released from ${slot.state}`);
  }
  return {
    ...slot,
    state: 'AVAILABLE',
    ownerKey: undefined,
    reservedCapital: 0,
    updatedAt: timestamp,
  };
}

export function markSlotOrphaned(slot: CapitalSlot, timestamp: string): CapitalSlot {
  return { ...slot, state: 'ORPHANED', updatedAt: timestamp };
}

export function markSlotStuck(slot: CapitalSlot, timestamp: string): CapitalSlot {
  return { ...slot, state: 'STUCK', updatedAt: timestamp };
}

export function isCapitalPoolStateValid(state: CapitalPoolState): boolean {
  return (
    Number.isFinite(state.configuredCapital) &&
    state.configuredCapital >= 0 &&
    Number.isFinite(state.allocatedCapital) &&
    state.allocatedCapital >= 0 &&
    Number.isFinite(state.reservedCapital) &&
    state.reservedCapital >= 0 &&
    state.reservedCapital <= state.allocatedCapital &&
    Number.isFinite(state.availableCapital) &&
    state.availableCapital >= 0 &&
    Math.abs(state.configuredCapital - state.availableCapital - state.allocatedCapital) < 1e-9
  );
}

export function isSlotActive(slot: CapitalSlot): boolean {
  return slot.state === 'RESERVED' || slot.state === 'ACTIVE';
}
