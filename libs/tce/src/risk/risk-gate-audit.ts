import type { TceRiskGateAuditEvent, TceRiskGateRequest, TceRiskGateResult } from '@tce/contracts';

export function createRiskGateAuditEvent(
  request: TceRiskGateRequest,
  result: TceRiskGateResult
): TceRiskGateAuditEvent {
  const base = {
    id: `risk-gate-audit:${request.intent.id}:${request.context.now}`,
    intentId: request.intent.id,
    pool: request.pool,
    correlationId: request.intent.correlationId,
    idempotencyKey: request.intent.idempotencyKey,
    occurredAt: request.context.now,
  };

  if (result.ok) {
    return {
      ...base,
      decision: 'APPROVED',
      riskAmount: result.riskAmount,
      overrideApplied: result.overrideApplied,
      ...(request.override && result.overrideApplied
        ? { overrideActor: request.override.actor, overrideReason: request.override.reason }
        : {}),
    };
  }

  return {
    ...base,
    decision: 'BLOCKED',
    code: result.code,
    message: result.message,
    riskAmount: Number.isFinite(request.riskAmount) ? request.riskAmount : undefined,
    overrideApplied: false,
  };
}
