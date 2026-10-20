import type {
  TceDecision,
  TceExecutionCommand,
  TceExecutionIntent,
  TceExecutionMode,
  TceRiskGateConfig,
  TceRiskGateContext,
  TceRiskGateRequest,
  TradeDecision,
} from '@tce/contracts';
import { createExecutionIntent } from '../order/order-planner';
import { approveExecutionIntent, type TceApprovedExecutionIntent } from '../risk/guarded-execution';

export type CapitalRotationExecutionRequest = Readonly<{
  decision: TradeDecision;
  decisionForExecution: TceDecision;
  orderPlanId: string;
  mode: TceExecutionMode;
  accountId: string;
  environment: string;
  clientRequestId: string;
  riskAmount: number;
  riskConfig: TceRiskGateConfig;
  riskContext: TceRiskGateContext;
  /** Board lot size for BUY preparation; defaults to 100 shares for VN equities. */
  lotSize?: number;
  /** Required for SELL preparation because the position size must come from account truth. */
  quantity?: number;
}>;

export type CapitalRotationExecutionPreparation =
  | Readonly<{
      ok: true;
      intent: TceExecutionIntent;
      approved: TceApprovedExecutionIntent;
      command: TceExecutionCommand;
    }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function prepareCapitalRotationExecution(
  request: CapitalRotationExecutionRequest
): CapitalRotationExecutionPreparation {
  if (request.decision.decision !== 'BUY' && request.decision.decision !== 'SELL') {
    return {
      ok: false,
      code: 'DECISION_NOT_EXECUTABLE',
      message: 'Only BUY and SELL CRDE decisions can reach execution preparation',
    };
  }

  const decision = request.decisionForExecution;
  if (!decision.id.trim() || !decision.symbol.trim() || !request.orderPlanId.trim()) {
    return {
      ok: false,
      code: 'INVALID_EXECUTION_IDENTITY',
      message: 'Decision id, symbol and orderPlanId are required',
    };
  }
  if (decision.action !== request.decision.decision) {
    return {
      ok: false,
      code: 'DECISION_MISMATCH',
      message: 'CRDE decision does not match execution decision',
    };
  }
  if (!Number.isInteger(decision.confidence) && !Number.isFinite(decision.confidence)) {
    return {
      ok: false,
      code: 'INVALID_CONFIDENCE',
      message: 'Decision confidence must be finite',
    };
  }

  const entryPrice = Number(decision.entry);
  const lotSize = request.lotSize ?? 100;
  if (!Number.isInteger(lotSize) || lotSize <= 0) {
    return {
      ok: false,
      code: 'INVALID_LOT_SIZE',
      message: 'lotSize must be a positive integer',
    };
  }
  let quantity: number;
  if (decision.action === 'BUY') {
    const budget = Math.min(Number(request.decision.capital), Number(request.riskContext.availableCapital));
    if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      return {
        ok: false,
        code: 'INVALID_ORDER_PLAN',
        message: 'BUY preparation requires positive capital and entry price',
      };
    }
    quantity = Math.floor(Math.floor(budget / entryPrice) / lotSize) * lotSize;
  } else {
    quantity = Number(request.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        code: 'INVALID_ORDER_PLAN',
        message: 'SELL preparation requires a positive integer quantity from the account position',
      };
    }
  }

  const orderPlan = {
    id: request.orderPlanId,
    decisionId: decision.id,
    symbol: decision.symbol,
    side: decision.action,
    quantity,
    entryPrice,
    targetPrice: decision.target > 0 ? decision.target : undefined,
    invalidationPrice: decision.invalidation,
    notional: quantity * entryPrice,
    pool: decision.pool,
    slotId: decision.slotId,
    createdAt: decision.decidedAt,
  };

  if (!Number.isFinite(orderPlan.entryPrice) || orderPlan.entryPrice <= 0) {
    return {
      ok: false,
      code: 'INVALID_ORDER_PLAN',
      message: 'Decision entry must be positive',
    };
  }

  const intentResult = createExecutionIntent(orderPlan, request.mode, decision.id);
  if (!intentResult.ok) return intentResult;

  const intent: TceExecutionIntent = {
    ...intentResult.intent,
    correlationId: request.decision.decisionId ?? decision.id,
    createdAt: request.riskContext.now,
  };

  const riskRequest: TceRiskGateRequest = {
    intent,
    pool: decision.pool,
    riskAmount: request.riskAmount,
    context: request.riskContext,
  };

  const approval = approveExecutionIntent(riskRequest, request.riskConfig);
  if (!approval.ok) return approval;

  return {
    ok: true,
    intent,
    approved: approval.approved,
    command: {
      operation: 'SUBMIT',
      accountId: request.accountId,
      environment: request.environment,
      mode: request.mode,
      authorization: {
        approvalId: approval.approved.approvalId,
        approvedAt: approval.approved.approvedAt,
        correlationId: intent.correlationId,
        idempotencyKey: intent.idempotencyKey,
      },
      intent,
      clientRequestId: request.clientRequestId,
    },
  };
}
