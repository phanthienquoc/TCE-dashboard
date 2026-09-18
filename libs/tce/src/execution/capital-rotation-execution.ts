import type {
  TceExecutionCommand,
  TceExecutionIntent,
  TceExecutionMode,
  TceRiskGateConfig,
  TceRiskGateContext,
  TceRiskGateRequest,
  TradeDecision,
} from '@tce/contracts';
import { approveExecutionIntent, type TceApprovedExecutionIntent } from '../risk/guarded-execution';
import { createExecutionIntent } from '../order/order-planner';

export type CapitalRotationExecutionRequest = Readonly<{
  decision: TradeDecision;
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
  | Readonly<{ ok: true; intent: TceExecutionIntent; approved: TceApprovedExecutionIntent; command: TceExecutionCommand }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function prepareCapitalRotationExecution(
  request: CapitalRotationExecutionRequest,
): CapitalRotationExecutionPreparation {
  if (request.decision.decision !== 'BUY' && request.decision.decision !== 'SELL') {
    return {
      ok: false,
      code: 'DECISION_NOT_EXECUTABLE',
      message: 'Only BUY and SELL CRDE decisions can reach execution preparation',
    };
  }
  if (!request.decision.decisionId || !request.decision.symbol || !request.orderPlanId.trim()) {
    return {
      ok: false,
      code: 'INVALID_EXECUTION_IDENTITY',
      message: 'Decision id, symbol and orderPlanId are required',
    };
  }

  const side = request.decision.decision;
  const plan = {
    id: request.orderPlanId,
    decisionId: request.decision.decisionId,
    symbol: request.decision.symbol,
    side,
    quantity: Number(request.decision.quantity ?? 0),
    entryPrice: Number(request.decision.entry ?? 0),
    targetPrice: Number(request.decision.target ?? 0) || undefined,
    invalidationPrice: Number(request.decision.invalidation ?? 0) || undefined,
    notional: Number(request.decision.notional ?? 0),
    pool: request.decision.pool!,
    slotId: request.decision.slot!,
    createdAt: request.decision.timestamp,
  };

  if (
    !Number.isInteger(plan.quantity) ||
    plan.quantity <= 0 ||
    !Number.isFinite(plan.entryPrice) ||
    plan.entryPrice <= 0
  ) {
    return {
      ok: false,
      code: 'INVALID_ORDER_PLAN',
      message: 'CRDE execution preparation requires a positive integer quantity and price',
    };
  }

  const intentResult = createExecutionIntent(plan, request.mode, request.decision.decisionId);
  if (!intentResult.ok) return intentResult;

  const now = request.riskContext.now;
  const intent: TceExecutionIntent = {
    ...intentResult.intent,
    correlationId: request.decision.decisionId,
    createdAt: now,
  };

  const riskRequest: TceRiskGateRequest = {
    intent,
    pool: request.decision.pool!,
    riskAmount: request.riskAmount,
    context: request.riskContext,
  };

  const approval = approveExecutionIntent(riskRequest, request.riskConfig);
  if (!approval.ok) return approval;

  const approvedAt = approval.approved.approvedAt;
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
        approvedAt,
        correlationId: intent.correlationId,
        idempotencyKey: intent.idempotencyKey,
      },
      intent,
      clientRequestId: request.clientRequestId,
    },
  };
}
