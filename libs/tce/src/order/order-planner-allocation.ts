import type { TceDecision } from '@tce/contracts';
import {
  CapitalSlotAllocator,
  type CapitalSlotAllocatorOutcome,
} from '../capital/capital-slot-allocator';
import { planBuyOrder, type OrderPlannerConfig, type OrderPlannerOutcome } from './order-planner';

export type AllocatedOrderPlanOutcome =
  | Readonly<{
      ok: true;
      plan: NonNullable<Extract<OrderPlannerOutcome, { ok: true }>['plan']>;
      allocation: CapitalSlotAllocatorOutcome & { ok: true };
    }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function allocateAndPlanBuyOrder(
  allocator: CapitalSlotAllocator,
  decision: TceDecision,
  config: OrderPlannerConfig,
  amount: number,
  timestamp: string
): AllocatedOrderPlanOutcome {
  const allocation = allocator.allocate({
    pool: decision.pool,
    ownerKey: `${decision.candidateId}:${decision.id}`,
    amount,
    timestamp,
  });
  if (!allocation.ok) return { ok: false, code: allocation.code, message: allocation.message };

  const planned = planBuyOrder(
    {
      decision,
      capital: allocation.allocation.allocation.amount,
      availableCapital: allocation.allocation.allocation.amount,
      slotAvailable: allocation.allocation.slot.state === 'RESERVED',
      price: decision.entry,
      timestamp,
    },
    config
  );
  if (!planned.ok) {
    allocator.release(`${decision.candidateId}:${decision.id}`, timestamp);
    return planned;
  }

  return { ok: true, plan: planned.plan, allocation };
}
