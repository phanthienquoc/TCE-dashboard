import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceDecision, TradeDecision } from '@tce/contracts';
import { TceExecutionOrchestrator } from './execution-orchestrator';
import { TcePaperExecutionPort } from './paper-execution';
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
  decisionId: 'crde:dpm:2',
  decisionWindowKey: '2026-09-18',
  strategyVersion: 'capital_rotation.v1',
  reasons: ['candidate_ranked'],
  timestamp: now,
};

const decisionForExecution: TceDecision = {
  id: 'crde:dpm:2',
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

const riskContext = {
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
};

test('CRDE prepared PAPER command executes through provider-neutral orchestrator', async () => {
  const prepared = prepareCapitalRotationExecution({
    decision: executionDecision,
    decisionForExecution,
    orderPlanId: 'order-plan:crde:dpm:2',
    mode: 'PAPER',
    accountId: 'account-1',
    environment: 'production',
    clientRequestId: 'crde-dpm-client-2',
    riskAmount: 50_000,
    riskConfig,
    riskContext,
  });

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const orchestrator = new TceExecutionOrchestrator(new TcePaperExecutionPort());
  const first = await orchestrator.execute(prepared.command);
  const second = await orchestrator.execute(prepared.command);

  assert.equal(first.ok, true);
  assert.equal(first.result.status, 'SUBMITTED');
  assert.equal(first.result.providerStatus, 'PAPER_ACCEPTED');
  assert.deepEqual(second, first);
});
