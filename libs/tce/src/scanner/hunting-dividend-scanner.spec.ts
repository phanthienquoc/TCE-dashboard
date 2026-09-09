import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HuntingDividendCandidateScanner,
  type HuntingDividendScannerInput,
} from './hunting-dividend-scanner';

const now = '2026-09-09T09:00:00.000Z';

function input(
  symbol: string,
  id: string,
  dividendValue: number,
  daysToEx = 5
): HuntingDividendScannerInput {
  return {
    dividend: {
      id,
      symbol,
      dividendType: 'CASH',
      dividendValue,
      exDividendAt: `2026-09-${String(9 + daysToEx).padStart(2, '0')}T09:00:00.000Z`,
      source: 'stock-events',
    },
    market: {
      symbol,
      price: 100,
      averageTurnover: 10_000_000,
      averageVolume: 100_000,
      volatility: 2,
      tradable: true,
      observedAt: now,
    },
    now,
  };
}

test('scanBatch returns deterministic score ordering', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const result = scanner.scanBatch([input('FPT', 'evt-fpt', 3000), input('DPM', 'evt-dpm', 5000)]);

  assert.deepEqual(
    result.map(candidate => candidate.symbol),
    ['DPM', 'FPT']
  );
  assert.equal(result.length, 2);
});

test('scanBatch deduplicates identical dividend-event and symbol pairs', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const result = scanner.scanBatch([input('DPM', 'evt-dpm', 5000), input('dpm', 'evt-dpm', 5000)]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.symbol, 'DPM');
});

test('scanBatch omits rejected inputs and preserves accepted candidates', () => {
  const scanner = new HuntingDividendCandidateScanner({ maxDataAgeMinutes: 10 });
  const stale = input('VIC', 'evt-vic', 5000);
  stale.market.observedAt = '2026-09-09T08:00:00.000Z';

  const result = scanner.scanBatch([stale, input('DPM', 'evt-dpm', 5000)]);

  assert.deepEqual(
    result.map(candidate => candidate.symbol),
    ['DPM']
  );
});

test('scanBatch uses symbol and candidate id as deterministic tie breakers', () => {
  const scanner = new HuntingDividendCandidateScanner();
  const result = scanner.scanBatch([
    input('VCB', 'evt-vcb', 3000, 5),
    input('DPM', 'evt-dpm', 3000, 5),
  ]);

  assert.deepEqual(
    result.map(candidate => candidate.symbol),
    ['DPM', 'VCB']
  );
});

test('scanDetailed returns explicit stale-data diagnostics', () => {
  const scanner = new HuntingDividendCandidateScanner({ maxDataAgeMinutes: 10 });
  const stale = input('VIC', 'evt-vic', 5000);
  stale.market.observedAt = '2026-09-09T08:00:00.000Z';

  const result = scanner.scanDetailed(stale);

  assert.equal(result.candidate, null);
  assert.deepEqual(result.rejectionReasons, ['stale_market_data']);
});

test('scanDetailed returns all applicable safety rejection reasons deterministically', () => {
  const scanner = new HuntingDividendCandidateScanner({
    minTurnover: 20_000_000,
    minVolume: 200_000,
    maxVolatility: 1,
  });
  const rejected = input('VIC', 'evt-vic', 5000);
  rejected.market.tradable = false;
  rejected.market.halted = true;
  rejected.market.abnormalEvent = true;
  rejected.market.averageTurnover = 1_000_000;
  rejected.market.averageVolume = 10_000;
  rejected.market.volatility = 5;

  const result = scanner.scanDetailed(rejected);

  assert.deepEqual(result.rejectionReasons, [
    'not_tradable',
    'halted',
    'abnormal_event',
    'insufficient_turnover',
    'insufficient_volume',
    'excessive_volatility',
  ]);
  assert.equal(result.candidate, null);
});

test('scan remains backward compatible with detailed rejection handling', () => {
  const scanner = new HuntingDividendCandidateScanner({ maxDataAgeMinutes: 10 });
  const stale = input('VIC', 'evt-vic', 5000);
  stale.market.observedAt = '2026-09-09T08:00:00.000Z';

  assert.equal(scanner.scan(stale), null);
});
