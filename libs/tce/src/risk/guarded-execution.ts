import type { TceExecutionIntent, TceRiskGateConfig, TceRiskGateRequest } from '@tce/contracts';
import { evaluateRiskSafetyGate } from './risk-safety-gate';

const riskApprovalBrand: unique symbol = Symbol('tce-risk-approval');

type RiskApprovalBrand = typeof riskApprovalBrand;

export type TceApprovedExecutionIntent = Readonly<{
  intent: TceExecutionIntent;
  pool: TceRiskGateRequest['pool'];
  riskAmount: number;
  approvedAt: string;
  approvalId: string;
  overrideApplied: boolean;
  readonly [riskApprovalBrand]: RiskApprovalBrand;
}>;

export type GuardedExecutionOutcome =
  | Readonly<{ ok: true; approved: TceApprovedExecutionIntent }>
  | Readonly<{ ok: false; code: string; message: string }>;

export function approveExecutionIntent(
  request: TceRiskGateRequest,
  config: TceRiskGateConfig
): GuardedExecutionOutcome {
  const result = evaluateRiskSafetyGate(request, config);
  if (!result.ok) return result;

  const approvedAt = request.context.now;
  return {
    ok: true,
    approved: {
      intent: result.intent,
      pool: request.pool,
      riskAmount: result.riskAmount,
      approvedAt,
      approvalId: `risk-approval:${result.intent.id}:${approvedAt}`,
      overrideApplied: result.overrideApplied,
      [riskApprovalBrand]: riskApprovalBrand,
    },
  };
}

export function isApprovedExecutionIntent(value: unknown): value is TceApprovedExecutionIntent {
  if (!value || typeof value !== 'object') return false;
  return (value as Partial<TceApprovedExecutionIntent>)[riskApprovalBrand] === riskApprovalBrand;
}
