import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionEngineContext, DecisionStockCandidate } from '@tce/contracts';
import { HuntingDividendCandidateScanner, type HuntingDividendScannerInput } from './hunting-dividend-scanner';

const now = '2026-09-09T09:00:00.000Z';

function input(symbol: string, dividendValue: number, observedAt = now): HuntingDividendScannerInput {
  return {
    dividend: {
      id: `evt-${symbol}`,
      symbol,
      dividendType: 'CASH',
      dividendValue,
      exDividendAt: '2026-09-20T09:00:00.000Z',
      source: 'stock-events',
    },
    market: {
      symbol,
      price: 100,
      averageTurnover: 10_000_000,
      averageVolume: 100_000,
      volatility: 2,
      tradable: true,
      observedAt,
    },
    now,
  };
}

function toDecisionCandidate(candidate: NonNullable<ReturnType<HuntingDividendCandidateScanner['scan']>>): DecisionStockCandidate {
  return {
    symbol: candidate.symbol,
    price: candidate.price,
    dividendValue: candidate.dividendContribution,
    gdkhqTimestamp: candidate.observedAt,
  };
}

test('scanner candidate is structurally consumable by DecisionEngineContext', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const candidate = scanner.scan(input('DPM', 5000));
  assert.ok(candidate);

  const decisionCandidate = toDecisionCandidate(candidate);
  const context: DecisionEngineContext = {
    timestamp: now,
    candidates: [decisionCandidate],
    capital: {
      totalCapital: 100_000_000,
      availableCash: 100_000_000,
      pendingCash: 0,
      stockSellableValue: 0,
      stockPendingT2Value: 0,
    },
    pools: [],
    positions: [],
  };

  assert.equal(context.candidates[0]?.symbol, 'DPM');
  assert.equal(context.candidates[0]?.price, 100);
  assert.equal(context.candidates[0]?.dividendValue, 5000);
});

test('stale market data cannot enter the decision-engine candidate input', () => {
  const scanner = new HuntingDividendCandidateScanner({ maxDataAgeMinutes: 10 });
  const candidate = scanner.scan(input('VIC', 5000, '2026-09-09T08:00:00.000Z'));

  assert.equal(candidate, null);
});

test('scanner output contains only provider-neutral candidate fields', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const candidate = scanner.scan(input('FPT', 3000));
  assert.ok(candidate);

  const allowed = new Set([
    'id',
    'symbol',
    'dividendEventId',
    'observedAt',
    'price',
    'score',
    'expectedReturn',
    'dividendContribution',
    'riskScore',
    'reasons',
    'invalidationReasons',
    'scannerVersion',
  ]);

  for (const key of Object.keys(candidate)) {
    assert.equal(allowed.has(key), true, `unexpected provider-specific field: ${key}`);
  }
});

test('identical scanner snapshots produce identical decision candidates and ordering', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const first = scanner.scanBatch([input('VCB', 3000), input('DPM', 5000)]).map(toDecisionCandidate);
  const second = scanner.scanBatch([input('VCB', 3000), input('DPM', 5000)]).map(toDecisionCandidate);

  assert.deepEqual(first, second);
  assert.deepEqual(first.map(candidate => candidate.symbol), ['DPM', 'VCB']);
});
