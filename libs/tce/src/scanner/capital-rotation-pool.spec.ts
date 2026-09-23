import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionStockCandidate } from '@tce/contracts';
import { CapitalRotationPoolScorer } from './capital-rotation-pool';

const now = '2026-09-18T02:00:00.000Z';

function candidate(overrides: Partial<DecisionStockCandidate>): DecisionStockCandidate {
  return {
    symbol: 'DPM',
    price: 100,
    dividendValue: 5000,
    dividendType: 'CASH',
    dividendYieldPct: 5,
    averageTurnover: 10_000_000,
    averageVolume: 100_000,
    observedAt: now,
    exRightDate: '2026-09-20T02:00:00.000Z',
    dividendEventId: 'event-dpm',
    ...overrides,
  };
}

test('Pool 20 scorer ranks deterministically and caps the output at 20', () => {
  const scorer = new CapitalRotationPoolScorer({ size: 20 });
  const input = [
    candidate({ symbol: 'VCB', dividendEventId: 'event-vcb', dividendYieldPct: 3 }),
    candidate({ symbol: 'DPM', dividendEventId: 'event-dpm', dividendYieldPct: 6 }),
    candidate({ symbol: 'DPM', dividendEventId: 'event-dpm', dividendYieldPct: 5 }),
  ];

  const first = scorer.rank(input, now);
  const second = scorer.rank(input, now);

  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0]?.symbol, 'DPM');
  assert.equal(first[0]?.poolRank, 1);
  assert.equal(first[1]?.symbol, 'VCB');
});

test('Pool 20 scorer rejects non-cash events', () => {
  const scorer = new CapitalRotationPoolScorer();
  const result = scorer.rank(
    [candidate({ symbol: 'ABC', dividendEventId: 'stock-bonus', dividendType: 'STOCK' })],
    now
  );

  assert.deepEqual(result, []);
});

test('Pool 20 scorer rejects stale or illiquid market snapshots', () => {
  const scorer = new CapitalRotationPoolScorer({ maxDataAgeMinutes: 60 });
  const result = scorer.rank(
    [
      candidate({
        symbol: 'STALE',
        observedAt: '2026-09-17T20:00:00.000Z',
      }),
      candidate({
        symbol: 'THIN',
        averageTurnover: 100_000,
      }),
    ],
    now
  );

  assert.deepEqual(result, []);
});

test('Pool 20 scorer produces bounded sub-scores and a rotation horizon', () => {
  const scorer = new CapitalRotationPoolScorer();
  const result = scorer.rank([candidate({})], now);
  const item = result[0];

  assert.ok(item);
  assert.ok(item.poolScore >= 0 && item.poolScore <= 100);
  assert.ok(item.dividendScore >= 0 && item.dividendScore <= 20);
  assert.ok(item.liquidityScore >= 0 && item.liquidityScore <= 15);
  assert.ok(item.recoveryScore >= 0 && item.recoveryScore <= 15);
  assert.ok(item.riskScore >= 0 && item.riskScore <= 10);
  assert.ok(item.turnoverScore >= 0 && item.turnoverScore <= 5);
  assert.ok(item.catalystScore >= 0 && item.catalystScore <= 10);
  assert.ok(item.expectedHoldDays >= 1 && item.expectedHoldDays <= 30);
});
