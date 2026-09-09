import type { TceDecision, TceExecutionIntent, TceOrderPlan } from '@tce/contracts';

export type OrderPlannerConfig = Readonly<{
  lotSize: number;
  minQuantity?: number;
  maxQuantity?: number;
  maxNotional?: number;
}>;

export type OrderPlannerRequest = Readonly<{
  decision: TceDecision;
  capital: number;
  availableCapital: number;
  slotAvailable: boolean;
  price: number;
  timestamp: string;
}>;

export type OrderPlannerOutcome =
  | Readonly<{ ok: true; plan: TceOrderPlan }>
  | Readonly<{ ok: false; code: string; message: string }>;

export type ExecutionIntentOutcome =
  | Readonly<{ ok: true; intent: TceExecutionIntent }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function planBuyOrder(
  request: OrderPlannerRequest,
  config: OrderPlannerConfig
): OrderPlannerOutcome {
  if (request.decision.action !== 'BUY') return { ok: false, code: 'DECISION_NOT_BUY', message: 'Only BUY decisions can be planned' };
  if (!request.slotAvailable) return { ok: false, code: 'SLOT_UNAVAILABLE', message: 'Decision slot is not available' };
  if (!Number.isFinite(request.price) || request.price <= 0) return { ok: false, code: 'INVALID_PRICE', message: 'Price must be positive and finite' };
  if (!Number.isFinite(request.capital) || request.capital <= 0) return { ok: false, code: 'INVALID_CAPITAL', message: 'Capital must be positive' };
  if (!Number.isFinite(request.availableCapital) || request.availableCapital <= 0) return { ok: false, code: 'NO_BUYING_POWER', message: 'Available capital must be positive' };
  if (!Number.isInteger(config.lotSize) || config.lotSize <= 0) return { ok: false, code: 'INVALID_LOT_SIZE', message: 'lotSize must be a positive integer' };

  const budget = Math.min(request.capital, request.availableCapital);
  const rawQuantity = Math.floor(budget / request.price);
  const quantity = Math.floor(rawQuantity / config.lotSize) * config.lotSize;
  if (quantity <= 0) return { ok: false, code: 'INSUFFICIENT_CAPITAL', message: 'Capital cannot purchase one board lot' };
  if (config.minQuantity !== undefined && quantity < config.minQuantity) return { ok: false, code: 'MIN_QUANTITY', message: 'Calculated quantity is below minimum' };
  if (config.maxQuantity !== undefined && quantity > config.maxQuantity) return { ok: false, code: 'MAX_QUANTITY', message: 'Calculated quantity exceeds maximum' };

  const notional = quantity * request.price;
  if (config.maxNotional !== undefined && notional > config.maxNotional) return { ok: false, code: 'MAX_NOTIONAL', message: 'Calculated notional exceeds maximum' };
  if (notional > request.availableCapital) return { ok: false, code: 'BUYING_POWER_EXCEEDED', message: 'Calculated notional exceeds available capital' };

  return {
    ok: true,
    plan: {
      id: `order-plan:${request.decision.id}:${request.decision.slotId}`,
      decisionId: request.decision.id,
      symbol: request.decision.symbol,
      side: 'BUY',
      quantity,
      entryPrice: request.price,
      targetPrice: request.decision.target,
      invalidationPrice: request.decision.invalidation,
      notional,
      pool: request.decision.pool,
      slotId: request.decision.slotId,
      createdAt: request.timestamp,
    },
  };
}

export function createExecutionIntent(
  plan: TceOrderPlan,
  mode: TceExecutionIntent['mode'],
  correlationId: string
): ExecutionIntentOutcome {
  if (!correlationId.trim()) return { ok: false, code: 'INVALID_CORRELATION_ID', message: 'correlationId is required' };
  if (plan.quantity <= 0 || plan.notional <= 0) return { ok: false, code: 'INVALID_PLAN', message: 'Order plan must contain positive quantity and notional' };
  const idempotencyKey = `tce:${plan.id}:${plan.side}:${plan.quantity}:${plan.entryPrice}`;
  return {
    ok: true,
    intent: {
      id: `execution-intent:${plan.id}`,
      orderPlanId: plan.id,
      correlationId,
      idempotencyKey,
      mode,
      symbol: plan.symbol,
      side: plan.side,
      quantity: plan.quantity,
      limitPrice: plan.entryPrice,
      lifecycleState: 'READY',
      createdAt: plan.createdAt,
    },
  };
}
