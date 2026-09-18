export type CrdeReadinessEvidence = {
  requiredPhasesVerified: boolean;
  paperMode: boolean;
  liveTradingEnabled: boolean;
  riskGateEnforced: boolean;
  killSwitchAvailable: boolean;
  auditTrailPersisted: boolean;
  smokeTestPassed: boolean;
  submittedOrders: number;
};

export type CrdeReadinessResult = {
  ready: boolean;
  reasons: readonly string[];
};

/**
 * Final CRDE demo gate. This is intentionally fail-closed: missing evidence,
 * live mode, a missing safety boundary, or any submitted order blocks demo
 * promotion. The gate is provider-neutral and does not submit orders.
 */
export function evaluateCrdeDemoReadiness(evidence: CrdeReadinessEvidence): CrdeReadinessResult {
  const reasons: string[] = [];

  if (!evidence.requiredPhasesVerified) {
    reasons.push('Required implementation phases are not fully verified');
  }
  if (!evidence.paperMode) {
    reasons.push('Demo must start in PAPER mode');
  }
  if (evidence.liveTradingEnabled) {
    reasons.push('Live trading must remain disabled at the demo gate');
  }
  if (!evidence.riskGateEnforced) {
    reasons.push('Risk/Safety Gate is not enforced');
  }
  if (!evidence.killSwitchAvailable) {
    reasons.push('Engine kill switch is not available');
  }
  if (!evidence.auditTrailPersisted) {
    reasons.push('Run/decision audit evidence is not persisted');
  }
  if (!evidence.smokeTestPassed) {
    reasons.push('CRDE E2E smoke test has not passed');
  }
  if (evidence.submittedOrders !== 0) {
    reasons.push('Demo readiness requires zero submitted live orders');
  }

  return { ready: reasons.length === 0, reasons };
}
