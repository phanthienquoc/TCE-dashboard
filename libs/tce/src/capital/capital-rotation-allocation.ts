import type { CapitalPoolId, TradeDecision } from '@tce/contracts';
import {
  CapitalSlotAllocator,
  createAllocatorSnapshot,
  type CapitalSlotAllocatorSnapshot,
} from './capital-slot-allocator';

export type CapitalRotationAllocation = Readonly<{
  decisionId: string;
  pool: CapitalPoolId;
  slotId: string;
  ownerKey: string;
  allocatedAmount: number;
  idempotencyKey: string;
  state: 'RESERVED' | 'ACTIVE' | 'RELEASED' | 'REALIZED';
}>;

export type CapitalRotationAllocationOutcome =
  | Readonly<{
      ok: true;
      allocation: CapitalRotationAllocation;
      snapshot: CapitalSlotAllocatorSnapshot;
    }>
  | Readonly<{ ok: false; code: string; message: string }>;

export type CapitalRotationAllocationRequest = Readonly<{
  decision: TradeDecision;
  timestamp: string;
}>;

export class CapitalRotationAllocationService {
  private readonly allocations = new Map<string, CapitalRotationAllocation>();

  constructor(private readonly allocator: CapitalSlotAllocator) {}

  reserve(request: CapitalRotationAllocationRequest): CapitalRotationAllocationOutcome {
    const decision = request.decision;
    if (decision.decision !== 'BUY') {
      return {
        ok: false,
        code: 'UNSUPPORTED_DECISION',
        message: 'Only BUY can reserve capital; got ' + decision.decision,
      };
    }
    if (!decision.decisionId || !decision.pool || !decision.symbol) {
      return {
        ok: false,
        code: 'INVALID_DECISION',
        message: 'BUY decision requires decisionId, pool and symbol',
      };
    }

    const amount = Number(decision.capital ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        code: 'INVALID_CAPITAL',
        message: 'BUY decision capital must be positive',
      };
    }

    const idempotencyKey = this.idempotencyKey(decision);
    const previous = this.allocations.get(idempotencyKey);
    if (previous) {
      return {
        ok: true,
        allocation: previous,
        snapshot: this.allocator.snapshot(),
      };
    }

    const ownerKey = [
      decision.engine,
      decision.candidateId ?? decision.symbol,
      decision.decisionId,
    ].join(':');

    const outcome = this.allocator.allocate({
      pool: decision.pool,
      ownerKey,
      amount,
      timestamp: request.timestamp,
    });
    if (!outcome.ok) return outcome;

    const allocation: CapitalRotationAllocation = {
      decisionId: decision.decisionId,
      pool: outcome.allocation.pool.pool,
      slotId: outcome.allocation.slot.id,
      ownerKey,
      allocatedAmount: amount,
      idempotencyKey,
      state: 'RESERVED',
    };
    this.allocations.set(idempotencyKey, allocation);

    return {
      ok: true,
      allocation,
      snapshot: this.allocator.snapshot(),
    };
  }

  activate(idempotencyKey: string, timestamp: string): CapitalRotationAllocationOutcome {
    const existing = this.allocations.get(idempotencyKey);
    if (!existing) {
      return {
        ok: false,
        code: 'ALLOCATION_NOT_FOUND',
        message: 'Allocation ' + idempotencyKey + ' was not found',
      };
    }
    if (existing.state === 'ACTIVE') {
      return {
        ok: true,
        allocation: existing,
        snapshot: this.allocator.snapshot(),
      };
    }

    const result = this.allocator.activate(existing.slotId, timestamp);
    if (!result.ok) return result;

    const next = { ...existing, state: 'ACTIVE' as const };
    this.allocations.set(idempotencyKey, next);
    return {
      ok: true,
      allocation: next,
      snapshot: this.allocator.snapshot(),
    };
  }

  release(idempotencyKey: string, timestamp: string): CapitalRotationAllocationOutcome {
    const existing = this.allocations.get(idempotencyKey);
    if (!existing) {
      return {
        ok: false,
        code: 'ALLOCATION_NOT_FOUND',
        message: 'Allocation ' + idempotencyKey + ' was not found',
      };
    }
    if (existing.state === 'RELEASED' || existing.state === 'REALIZED') {
      return {
        ok: true,
        allocation: existing,
        snapshot: this.allocator.snapshot(),
      };
    }

    const result = this.allocator.release(existing.ownerKey, timestamp);
    if (!result.ok) return result;

    const next = { ...existing, state: 'RELEASED' as const };
    this.allocations.set(idempotencyKey, next);
    return {
      ok: true,
      allocation: next,
      snapshot: this.allocator.snapshot(),
    };
  }

  realize(
    idempotencyKey: string,
    timestamp: string,
    pnl: number
  ): CapitalRotationAllocationOutcome {
    const existing = this.allocations.get(idempotencyKey);
    if (!existing) {
      return {
        ok: false,
        code: 'ALLOCATION_NOT_FOUND',
        message: 'Allocation ' + idempotencyKey + ' was not found',
      };
    }
    if (existing.state === 'REALIZED') {
      return {
        ok: true,
        allocation: existing,
        snapshot: this.allocator.snapshot(),
      };
    }
    if (existing.state !== 'ACTIVE') {
      return {
        ok: false,
        code: 'NOT_ACTIVE',
        message: 'Allocation ' + idempotencyKey + ' must be ACTIVE before realize',
      };
    }
    if (!Number.isFinite(pnl)) {
      return {
        ok: false,
        code: 'INVALID_PNL',
        message: 'pnl must be finite',
      };
    }

    const released = this.allocator.realize(existing.ownerKey, pnl, timestamp);
    if (!released.ok) return released;

    const next = { ...existing, state: 'REALIZED' as const };
    this.allocations.set(idempotencyKey, next);
    return {
      ok: true,
      allocation: next,
      snapshot: this.allocator.snapshot(),
    };
  }

  get(idempotencyKey: string): CapitalRotationAllocation | undefined {
    return this.allocations.get(idempotencyKey);
  }

  snapshot(): CapitalSlotAllocatorSnapshot {
    return this.allocator.snapshot();
  }

  private idempotencyKey(decision: TradeDecision): string {
    return ['crde', decision.strategyVersion ?? 'unknown', decision.decisionId].join(':');
  }
}

export function createCapitalRotationAllocationService(
  pools: ReadonlyArray<{
    pool: CapitalPoolId;
    capital: number;
    slots: number;
  }>,
  timestamp: string
): CapitalRotationAllocationService {
  return new CapitalRotationAllocationService(
    new CapitalSlotAllocator(
      createAllocatorSnapshot(
        pools.map(pool => ({
          pool: pool.pool,
          configuredCapital: pool.capital,
          slotCount: pool.slots,
        })),
        timestamp
      )
    )
  );
}
