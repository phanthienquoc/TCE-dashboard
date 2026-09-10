import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceExecutionIntent, TceRiskGateContext, TceRiskGateRequest } from '@tce/contracts';
import { evaluateRiskSafetyGate } from './risk-safety-gate';

const intent: TceExecutionIntent = {
  id: 'execution-intent:order-plan:decision-1:slot-1',
  orderPlanId: 'order-plan:decision-1:slot-1',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  mode: 'PAPER',
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
  engineState: 'RUNNING',
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

test('passes a valid intent within risk and exposure limits', () => {
  assert.deepEqual(evaluateRiskSafetyGate(request(), config), {
    ok: true,
    intent,
    riskAmount: 300_000,
    overrideApplied: false,
  });
});

test('rejects unclear risk', () => {
  const result = evaluateRiskSafetyGate(request({ riskAmount: 0 }), config);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'UNCLEAR_RISK');
});

test('rejects stale intents', () => {
  const result = evaluateRiskSafetyGate(request({ context: { ...context, now: '2026-09-10T01:02:00.000Z' } }), config);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'STALE_INTENT');
});

test('rejects stale or missing market data when freshness is required', () => {
  const freshnessConfig = { ...config, maxMarketDataAgeMs: 30_000 };
  const missing = evaluateRiskSafetyGate(request(), freshnessConfig);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, 'STALE_MARKET_DATA');

  const stale = evaluateRiskSafetyGate(request({ context: { ...context, marketDataAt: '2026-09-10T00:59:00.000Z' } }), freshnessConfig);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'STALE_MARKET_DATA');

  const fresh = evaluateRiskSafetyGate(request({ context: { ...context, marketDataAt: context.now } }), freshnessConfig);
  assert.equal(fresh.ok, true);
});

test('rejects required dividend data without a freshness policy or with stale data', () => {
  const noPolicy = evaluateRiskSafetyGate(request({ context: { ...context, dividendDataRequired: true } }), config);
  assert.equal(noPolicy.ok, false);
  if (!noPolicy.ok) assert.equal(noPolicy.code, 'STALE_DIVIDEND_DATA');

  const freshConfig = { ...config, maxDividendDataAgeMs: 30_000 };
  const stale = evaluateRiskSafetyGate(request({ context: { ...context, dividendDataRequired: true, dividendDataAt: '2026-09-10T00:59:00.000Z' } }), freshConfig);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'STALE_DIVIDEND_DATA');

  const fresh = evaluateRiskSafetyGate(request({ context: { ...context, dividendDataRequired: true, dividendDataAt: context.now } }), freshConfig);
  assert.equal(fresh.ok, true);
});

test('rejects major-news risk when configured', () => {
  const result = evaluateRiskSafetyGate(request({ context: { ...context, majorNewsRisk: true } }), { ...config, blockOnMajorNews: true });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'MAJOR_NEWS_RISK');
});

test('rejects global and pool kill switches', () => {
  const globalStop = evaluateRiskSafetyGate(request({ context: { ...context, engineKillSwitch: true } }), config);
  assert.equal(globalStop.ok, false);
  if (!globalStop.ok) assert.equal(globalStop.code, 'ENGINE_KILL_SWITCH');

  const poolStop = evaluateRiskSafetyGate(request({ context: { ...context, killedPools: ['A'] } }), config);
  assert.equal(poolStop.ok, false);
  if (!poolStop.ok) assert.equal(poolStop.code, 'POOL_KILL_SWITCH');
});

test('blocks LIVE execution while the engine is not RUNNING', () => {
  const liveIntent = { ...intent, mode: 'LIVE' as const };
  const stopped = evaluateRiskSafetyGate(
    request({ intent: liveIntent, context: { ...context, engineState: 'STOPPED' } }),
    config
  );
  assert.equal(stopped.ok, false);
  if (!stopped.ok) assert.equal(stopped.code, 'ENGINE_NOT_RUNNING');

  const paper = evaluateRiskSafetyGate(
    request({ context: { ...context, engineState: 'STOPPED' } }),
    config
  );
  assert.equal(paper.ok, true);

  const liveRunning = evaluateRiskSafetyGate(
    request({ intent: liveIntent }),
    config
  );
  assert.equal(liveRunning.ok, true);
});

test('rejects blocked and non-allow-listed symbols', () => {
  const blocked = evaluateRiskSafetyGate(request({ context: { ...context, blockedSymbols: ['dpm'] } }), config);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, 'SYMBOL_BLOCKED');

  const notAllowed = evaluateRiskSafetyGate(request({ context: { ...context, allowedSymbols: ['HPG'] } }), config);
  assert.equal(notAllowed.ok, false);
  if (!notAllowed.ok) assert.equal(notAllowed.code, 'SYMBOL_NOT_ALLOWED');
});

test('rejects buying power and concurrent exposure violations', () => {
  const capital = evaluateRiskSafetyGate(request({ context: { ...context, availableCapital: 1_000_000 } }), config);
  assert.equal(capital.ok, false);
  if (!capital.ok) assert.equal(capital.code, 'BUYING_POWER_EXCEEDED');

  const exposure = evaluateRiskSafetyGate(request({ context: { ...context, concurrentExposure: 19_000_000 } }), config);
  assert.equal(exposure.ok, false);
  if (!exposure.ok) assert.equal(exposure.code, 'MAX_CONCURRENT_EXPOSURE');
});

test('requires explicit audit fields for manual override and allows an approved risk override', () => {
  const invalidOverride = evaluateRiskSafetyGate(request({
    riskAmount: 600_000,
    override: { approved: true, actor: '', reason: 'emergency', approvedAt: context.now },
  }), config);
  assert.equal(invalidOverride.ok, false);
  if (!invalidOverride.ok) assert.equal(invalidOverride.code, 'INVALID_MANUAL_OVERRIDE');

  const validOverride = evaluateRiskSafetyGate(request({
    riskAmount: 600_000,
    override: { approved: true, actor: 'ops-user', reason: 'documented exception', approvedAt: context.now },
  }), config);
  assert.deepEqual(validOverride, { ok: true, intent, riskAmount: 600_000, overrideApplied: true });
});
