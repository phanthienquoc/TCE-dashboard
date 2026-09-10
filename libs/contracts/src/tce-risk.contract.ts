import type { TceCapitalPoolId, TceExecutionIntent } from './tce-auto-trade.contract';

export type TceRiskGateConfig = Readonly<{
  maxRiskPerTrade: number;
  maxConcurrentExposure: number;
  maxIntentAgeMs: number;
}>;

export type TceRiskGateContext = Readonly<{
  now: string;
  availableCapital: number;
  concurrentExposure: number;
  poolExposure: Readonly<Record<TceCapitalPoolId, number>>;
  engineKillSwitch: boolean;
  killedPools: readonly TceCapitalPoolId[];
  blockedSymbols: readonly string[];
  allowedSymbols?: readonly string[];
}>;

export type TceRiskOverride = Readonly<{
  approved: true;
  actor: string;
  reason: string;
  approvedAt: string;
}>;

export type TceRiskGateRequest = Readonly<{
  intent: TceExecutionIntent;
  pool: TceCapitalPoolId;
  riskAmount: number;
  context: TceRiskGateContext;
  override?: TceRiskOverride;
}>;

export type TceRiskGateResult =
  | Readonly<{ ok: true; intent: TceExecutionIntent; riskAmount: number; overrideApplied: boolean }>
  | Readonly<{ ok: false; code: string; message: string }>;
