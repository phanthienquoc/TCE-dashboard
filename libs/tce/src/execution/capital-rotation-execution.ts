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
  const capital = Number(request.decision.capital ?? 0);
  const availableCapital = Number(request.riskContext.availableCapital);
  if (
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    !Number.isFinite(capital) ||
    capital <= 0 ||
    !Number.isFinite(availableCapital) ||
    availableCapital <= 0
  ) {
    return {
      ok: false,
      code: 'INVALID_ORDER_PLAN',
      message: 'Positive entry price, decision capital and available capital are required',
    };
  }

  const quantity = Math.floor(Math.min(capital, availableCapital) / entryPrice);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      ok: false,
      code: 'INVALID_ORDER_PLAN',
      message: 'Capital cannot purchase at least one share',
    };
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
    correlationId: request.decision.decisionId ?? request.orderPlanId,
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
