import type { CapitalPoolId } from '@tce/contracts';

type Position = {
  pool?: string;
  costBasis?: number;
  cost_basis?: number;
  avgBuyCost?: number;
  avg_cost?: number;
  quantity?: number;
};

export type DashboardCapitalPoolState = {
  pool: CapitalPoolId;
  allocatedCapital: number;
  availableCapital: number;
  pendingT2Capital: number;
  usedCapital: number;
  occupiedSlots: number;
  totalSlots: number;
  usedRatio: number;
  state: 'READY' | 'ACTIVE' | 'T+2' | 'FULL';
};

/** BE source of truth for capital-pool allocation and display state. */
export class DashboardCapitalPoolEngine {
  calculate(input: { totalCapital: number; availableCash: number; pendingT2Capital?: number; positions: readonly Position[]; slotsPerPool?: number }): DashboardCapitalPoolState[] {
    const pools: CapitalPoolId[] = ['A', 'B', 'C'];
    const slots = Math.max(1, Math.floor(Number(input.slotsPerPool ?? 1)));
    const totalCapital = Math.max(0, Number(input.totalCapital) || 0);
    const availableCash = Math.max(0, Number(input.availableCash) || 0);
    const pendingCash = Math.max(0, Number(input.pendingT2Capital) || 0);
    const allocated = totalCapital / pools.length;
    const used = new Map<CapitalPoolId, number>();
    const occupied = new Map<CapitalPoolId, number>();
    for (const pool of pools) { used.set(pool, 0); occupied.set(pool, 0); }
    for (const position of input.positions) {
      const pool = String(position.pool ?? '').trim().toUpperCase() as CapitalPoolId;
      if (!pools.includes(pool)) continue;
      const costBasis = Number(position.costBasis ?? position.cost_basis);
      const fallback = Number(position.avgBuyCost ?? position.avg_cost ?? 0) * Number(position.quantity ?? 0);
      used.set(pool, (used.get(pool) ?? 0) + (Number.isFinite(costBasis) ? Math.max(0, costBasis) : Math.max(0, fallback)));
      occupied.set(pool, (occupied.get(pool) ?? 0) + 1);
    }
    const free = new Map<CapitalPoolId, number>();
    let totalFree = 0;
    for (const pool of pools) { const value = Math.max(0, allocated - Math.min(allocated, used.get(pool) ?? 0)); free.set(pool, value); totalFree += value; }
    return pools.map(pool => {
      const usedCapital = Math.min(allocated, used.get(pool) ?? 0);
      const freeCapacity = free.get(pool) ?? 0;
      const share = totalFree > 0 ? freeCapacity / totalFree : 1 / pools.length;
      const availableCapital = Math.min(freeCapacity, availableCash * share);
      const pendingT2Capital = Math.min(Math.max(0, freeCapacity - availableCapital), pendingCash * share);
      const occupiedSlots = occupied.get(pool) ?? 0;
      const state = pendingT2Capital > 0 ? 'T+2' : occupiedSlots > 0 ? (usedCapital >= allocated ? 'FULL' : 'ACTIVE') : 'READY';
      return { pool, allocatedCapital: Math.round(allocated), availableCapital: Math.round(availableCapital), pendingT2Capital: Math.round(pendingT2Capital), usedCapital: Math.round(usedCapital), occupiedSlots, totalSlots: slots, usedRatio: allocated > 0 ? Math.min(1, usedCapital / allocated) : 0, state };
    });
  }
}
