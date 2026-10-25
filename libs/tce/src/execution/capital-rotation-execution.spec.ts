import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceDecision } from '@tce/contracts';
import type { TradeDecision } from '@tce/contracts';
import { prepareCapitalRotationExecution } from './capital-rotation-execution';

const now = '2026-09-18T03:00:00.000Z';

const executionDecision: TradeDecision = {
  engine: 'capital_rotation_decision',
  decision: 'BUY',
  symbol: 'DPM',
  pool: 'A',
  slot: 'A1',
  capital: 8_000_000,
  entry: 100,
  target: 105,
  confidence: 0.8,
  candidateId: 'candidate:dpm',
  decisionId: 'crde:dpm:1',
  decisionWindowKey: '2026-09-18',
  strategyVersion: 'capital_rotation.v1',
  reasons: ['candidate_ranked'],
  timestamp: now,
};

const decisionForExecution: TceDecision = {
  id: 'crde:dpm:1',
  candidateId: 'candidate:dpm',
  symbol: 'DPM',
  action: 'BUY',
  pool: 'A',
  slotId: 'A1',
  entry: 100,
  target: 105,
  invalidation: 95,
  confidence: 0.8,
  reasons: ['candidate_ranked'],
  strategyVersion: 'capital_rotation.v1',
  decidedAt: now,
};

const riskConfig = {
  maxRiskPerTrade: 100_000,
  maxConcurrentExposure: 10_000_000,
  maxIntentAgeMs: 60_000,
  maxMarketDataAgeMs: 60_000,
  maxDividendDataAgeMs: 60_000,
  blockOnMajorNews: true,
};

function riskContext(overrides: Record<string, unknown> = {}) {
  return {
    now,
    availableCapital: 8_000_000,
    concurrentExposure: 0,
    poolExposure: { A: 0, B: 0, C: 0 },
    engineState: 'RUNNING' as const,
    engineKillSwitch: false,
    killedPools: [],
    blockedSymbols: [],
    dividendDataRequired: true,
    marketDataAt: now,
    dividendDataAt: now,
    majorNewsRisk: false,
    ...overrides,
  };
}

test('CRDE execution preparation creates a provider-neutral approved PAPER command', () => {
  const result = prepareCapitalRotationExecution({
    decision: executionDecision,
    decisionForExecution,
    orderPlanId: 'order-plan:crde:dpm:1',
    mode: 'PAPER',
    accountId: 'account-1',
    environment: 'production',
    clientRequestId: 'crde-dpm-client-1',
    riskAmount: 50_000,
    riskConfig,
    riskContext: riskContext(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.intent.mode, 'PAPER');
  assert.equal(result.intent.symbol, 'DPM');
  assert.equal(result.intent.limitPrice, 100);
  assert.equal(result.command.operation, 'SUBMIT');
  assert.equal(result.command.authorization.idempotencyKey, result.intent.idempotencyKey);
});

test('CRDE execution preparation fails closed on stale market data', () => {
  const result = prepareCapitalRotationExecution({
    decision: executionDecision,
    decisionForExecution,
    orderPlanId: 'order-plan:crde:dpm:1',
    mode: 'PAPER',
    accountId: 'account-1',
    environment: 'production',
    clientRequestId: 'crde-dpm-client-1',
    riskAmount: 50_000,
    riskConfig,
    riskContext: riskContext({ marketDataAt: '2026-09-17T00:00:00.000Z' }),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'STALE_MARKET_DATA');
});

test('CRDE execution preparation rejects mismatched decision action', () => {
  const result = prepareCapitalRotationExecution({
    decision: { ...executionDecision, decision: 'SELL' },
    decisionForExecution,
    orderPlanId: 'order-plan:crde:dpm:1',
    mode: 'PAPER',
    accountId: 'account-1',
    environment: 'production',
    clientRequestId: 'crde-dpm-client-1',
    riskAmount: 50_000,
    riskConfig,
    riskContext: riskContext(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'DECISION_MISMATCH');
});
