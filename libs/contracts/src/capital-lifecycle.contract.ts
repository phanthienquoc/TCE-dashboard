import type { CapitalPoolState, CapitalSlot } from './capital-allocation.contract';

export type CapitalAllocationLifecycleState =
  | 'RESERVED'
  | 'PARTIALLY_FILLED'
  | 'ACTIVE'
  | 'RELEASED'
  | 'REALIZED'
  | 'ORPHANED'
  | 'STUCK';

export type CapitalAllocationLifecycle = Readonly<{
  ownerKey: string;
  pool: CapitalPoolState;
  slot: CapitalSlot;
  allocatedAmount: number;
  reservedAmount: number;
  filledAmount: number;
  state: CapitalAllocationLifecycleState;
  updatedAt: string;
}>;

export type CapitalLifecycleOutcome =
  | Readonly<{ ok: true; lifecycle: CapitalAllocationLifecycle }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function transitionPartialFill(
  lifecycle: CapitalAllocationLifecycle,
  filledAmount: number,
  timestamp: string
): CapitalLifecycleOutcome {
  if (!Number.isFinite(filledAmount) || filledAmount < 0 || filledAmount > lifecycle.allocatedAmount) {
    return { ok: false, code: 'INVALID_FILL', message: 'filledAmount must be within allocated amount' };
  }
  if (filledAmount < lifecycle.filledAmount) {
    return { ok: false, code: 'FILL_REGRESSION', message: 'filledAmount cannot decrease' };
  }
  const reservedAmount = lifecycle.allocatedAmount - filledAmount;
  const releasedReservation = lifecycle.reservedAmount - reservedAmount;
  if (releasedReservation < 0) {
    return { ok: false, code: 'INVALID_RESERVATION', message: 'fill exceeds currently reserved capital' };
  }
  const nextPool: CapitalPoolState = {
    ...lifecycle.pool,
    reservedCapital: lifecycle.pool.reservedCapital - releasedReservation,
  };
  const nextSlot: CapitalSlot = {
    ...lifecycle.slot,
    reservedCapital: reservedAmount,
    state: filledAmount === 0 ? lifecycle.slot.state : filledAmount === lifecycle.allocatedAmount ? 'ACTIVE' : 'RESERVED',
    updatedAt: timestamp,
  };
  return {
    ok: true,
    lifecycle: {
      ...lifecycle,
      pool: nextPool,
      slot: nextSlot,
      filledAmount,
      reservedAmount,
      state: filledAmount === 0 ? lifecycle.state : filledAmount === lifecycle.allocatedAmount ? 'ACTIVE' : 'PARTIALLY_FILLED',
      updatedAt: timestamp,
    },
  };
}

export function releaseUnfilledCapital(
  lifecycle: CapitalAllocationLifecycle,
  timestamp: string
): CapitalLifecycleOutcome {
  if (lifecycle.reservedAmount < 0 || lifecycle.reservedAmount > lifecycle.allocatedAmount) {
    return { ok: false, code: 'INVALID_RESERVATION', message: 'reservedAmount is outside allocation bounds' };
  }
  if (lifecycle.state === 'REALIZED' || lifecycle.state === 'RELEASED') {
    return { ok: true, lifecycle };
  }
  const nextPool: CapitalPoolState = {
    ...lifecycle.pool,
    allocatedCapital: lifecycle.pool.allocatedCapital - lifecycle.reservedAmount,
    reservedCapital: lifecycle.pool.reservedCapital - lifecycle.reservedAmount,
    availableCapital: lifecycle.pool.availableCapital + lifecycle.reservedAmount,
  };
  const nextSlot: CapitalSlot = {
    ...lifecycle.slot,
    state: lifecycle.filledAmount > 0 ? 'ACTIVE' : 'AVAILABLE',
    ownerKey: lifecycle.filledAmount > 0 ? lifecycle.ownerKey : undefined,
    reservedCapital: 0,
    updatedAt: timestamp,
  };
  return {
    ok: true,
    lifecycle: {
      ...lifecycle,
      pool: nextPool,
      slot: nextSlot,
      allocatedAmount: lifecycle.filledAmount,
      reservedAmount: 0,
      state: lifecycle.filledAmount > 0 ? 'ACTIVE' : 'RELEASED',
      updatedAt: timestamp,
    },
  };
}

export function realizeClosedCapital(
  lifecycle: CapitalAllocationLifecycle,
  pnl: number,
  timestamp: string
): CapitalLifecycleOutcome {
  if (!Number.isFinite(pnl)) return { ok: false, code: 'INVALID_PNL', message: 'pnl must be finite' };
  if (lifecycle.state !== 'ACTIVE' && lifecycle.state !== 'PARTIALLY_FILLED') {
    return { ok: false, code: 'NOT_ACTIVE', message: 'Only an active allocation can be realized' };
  }
  if (lifecycle.reservedAmount !== 0) {
    return { ok: false, code: 'UNRELEASED_RESERVE', message: 'Unfilled capital must be released before close' };
  }
  const nextPool: CapitalPoolState = {
    ...lifecycle.pool,
    allocatedCapital: lifecycle.pool.allocatedCapital - lifecycle.filledAmount,
    availableCapital: lifecycle.pool.availableCapital + lifecycle.filledAmount + pnl,
    realizedCapital: lifecycle.pool.realizedCapital + pnl,
  };
  const nextSlot: CapitalSlot = {
    ...lifecycle.slot,
    state: 'AVAILABLE',
    ownerKey: undefined,
    reservedCapital: 0,
    updatedAt: timestamp,
  };
  return {
    ok: true,
    lifecycle: {
      ...lifecycle,
      pool: nextPool,
      slot: nextSlot,
      allocatedAmount: 0,
      reservedAmount: 0,
      state: 'REALIZED',
      updatedAt: timestamp,
    },
  };
}

export function markAllocationOrphaned(
  lifecycle: CapitalAllocationLifecycle,
  timestamp: string
): CapitalLifecycleOutcome {
  if (lifecycle.state === 'RELEASED' || lifecycle.state === 'REALIZED') {
    return { ok: false, code: 'TERMINAL_ALLOCATION', message: 'Terminal allocations cannot become orphaned' };
  }
  return { ok: true, lifecycle: { ...lifecycle, state: 'ORPHANED', updatedAt: timestamp } };
}

export function markAllocationStuck(
  lifecycle: CapitalAllocationLifecycle,
  timestamp: string
): CapitalLifecycleOutcome {
  if (lifecycle.state === 'RELEASED' || lifecycle.state === 'REALIZED') {
    return { ok: false, code: 'TERMINAL_ALLOCATION', message: 'Terminal allocations cannot become stuck' };
  }
  return { ok: true, lifecycle: { ...lifecycle, state: 'STUCK', updatedAt: timestamp } };
}
