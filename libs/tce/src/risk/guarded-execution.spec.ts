import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceExecutionIntent, TceRiskGateContext, TceRiskGateRequest } from '@tce/contracts';
import { approveExecutionIntent, isApprovedExecutionIntent } from './guarded-execution';

const intent: TceExecutionIntent = {
  id: 'execution-intent:order-plan:decision-1:slot-1',
  orderPlanId: 'order-plan:decision-1:slot-1',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  mode: 'ASSISTED',
  symbol: 'DPM',
  side: 'BUY',
  quantity: 300,
  limitPrice: 28_500,
  lifecycleState: 'READY',
  createdAt: '2026-09-10T01:00:00.000Z',
};

const context: TceRiskGateContext = {
  now: '2026-09-10T01:00:10.000Z',
  availableCapital: 10_000_000,
  concurrentExposure: 0,
  poolExposure: { A: 0, B: 0, C: 0 },
  engineKillSwitch: false,
  killedPools: [],
  blockedSymbols: [],
};

const request = (overrides: Partial<TceRiskGateRequest> = {}): TceRiskGateRequest => ({
  intent,
  pool: 'A',
  riskAmount: 300_000,
  context,
  ...overrides,
});

const config = {
  maxRiskPerTrade: 500_000,
  maxConcurrentExposure: 20_000_000,
  maxIntentAgeMs: 60_000,
};

test('wraps only a risk-approved intent in the guarded execution envelope', () => {
  const result = approveExecutionIntent(request(), config);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.approved.intent, intent);
  assert.equal(result.approved.pool, 'A');
  assert.equal(result.approved.riskAmount, 300_000);
  assert.equal(result.approved.approvedAt, context.now);
  assert.equal(result.approved.approvalId, `risk-approval:${intent.id}:${context.now}`);
  assert.equal(result.approved.overrideApplied, false);
  assert.equal(isApprovedExecutionIntent(result.approved), true);
});

test('does not create an approval for a blocked execution intent', () => {
  const result = approveExecutionIntent(request({ context: { ...context, engineKillSwitch: true } }), config);
  assert.deepEqual(result, {
    ok: false,
    code: 'ENGINE_KILL_SWITCH',
    message: 'Global engine kill switch is active',
  });
});

test('rejects an unbranded raw intent at the guarded-boundary runtime check', () => {
  assert.equal(isApprovedExecutionIntent(intent), false);
  assert.equal(isApprovedExecutionIntent({ intent }), false);
});
