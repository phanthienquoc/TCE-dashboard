import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceExecutionIntent, TceRiskGateContext, TceRiskGateRequest } from '@tce/contracts';
import { evaluateRiskSafetyGate } from './risk-safety-gate';
import { createRiskGateAuditEvent } from './risk-gate-audit';

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

test('creates deterministic approved audit events and records override metadata', () => {
  const gateRequest = request({
    riskAmount: 600_000,
    override: { approved: true, actor: 'ops-user', reason: 'documented exception', approvedAt: context.now },
  });
  const result = evaluateRiskSafetyGate(gateRequest, config);
  assert.equal(result.ok, true);
  const event = createRiskGateAuditEvent(gateRequest, result);

  assert.deepEqual(event, {
    id: `risk-gate-audit:${intent.id}:${context.now}`,
    intentId: intent.id,
    pool: 'A',
    decision: 'APPROVED',
    correlationId: intent.correlationId,
    idempotencyKey: intent.idempotencyKey,
    riskAmount: 600_000,
    overrideApplied: true,
    overrideActor: 'ops-user',
    overrideReason: 'documented exception',
    occurredAt: context.now,
  });

  assert.deepEqual(createRiskGateAuditEvent(gateRequest, result), event);
});

test('creates a blocked audit event with deterministic failure diagnostics', () => {
  const gateRequest = request({ context: { ...context, engineKillSwitch: true } });
  const result = evaluateRiskSafetyGate(gateRequest, config);
  assert.equal(result.ok, false);

  const event = createRiskGateAuditEvent(gateRequest, result);
  assert.deepEqual(event, {
    id: `risk-gate-audit:${intent.id}:${context.now}`,
    intentId: intent.id,
    pool: 'A',
    decision: 'BLOCKED',
    correlationId: intent.correlationId,
    idempotencyKey: intent.idempotencyKey,
    riskAmount: 300_000,
    code: 'ENGINE_KILL_SWITCH',
    message: 'Global engine kill switch is active',
    overrideApplied: false,
    occurredAt: context.now,
  });
});
