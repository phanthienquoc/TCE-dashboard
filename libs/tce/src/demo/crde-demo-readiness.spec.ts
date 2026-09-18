import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCrdeDemoReadiness } from './crde-demo-readiness';

const safeEvidence = {
  requiredPhasesVerified: true,
  paperMode: true,
  liveTradingEnabled: false,
  riskGateEnforced: true,
  killSwitchAvailable: true,
  auditTrailPersisted: true,
  smokeTestPassed: true,
  submittedOrders: 0,
} as const;

test('CRDE demo readiness passes only when every gate is green', () => {
  assert.deepEqual(evaluateCrdeDemoReadiness(safeEvidence), {
    ready: true,
    reasons: [],
  });
});

test('CRDE demo readiness fails closed when live trading is enabled', () => {
  const result = evaluateCrdeDemoReadiness({
    ...safeEvidence,
    liveTradingEnabled: true,
  });

  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('Live trading must remain disabled at the demo gate'));
});

test('CRDE demo readiness fails closed when safety controls are missing', () => {
  const result = evaluateCrdeDemoReadiness({
    ...safeEvidence,
    riskGateEnforced: false,
    killSwitchAvailable: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.reasons, [
    'Risk/Safety Gate is not enforced',
    'Engine kill switch is not available',
  ]);
});

test('CRDE demo readiness fails closed when any live order was submitted', () => {
  const result = evaluateCrdeDemoReadiness({
    ...safeEvidence,
    submittedOrders: 1,
  });

  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes('Demo readiness requires zero submitted live orders'));
});
