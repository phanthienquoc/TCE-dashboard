import assert from 'node:assert/strict';
import test from 'node:test';
import { HuntingDividendScannerService } from './hunting-dividend-scanner.service';

test('scanRows normalizes stock-events rows and returns deterministic candidates', () => {
  const service = new HuntingDividendScannerService({
    getUpcoming: async () => [],
  } as never);
  const market = {
    symbol: 'dpm',
    price: 100,
    averageTurnover: 10_000_000,
    averageVolume: 100_000,
    volatility: 2,
    tradable: true,
    observedAt: '2026-09-09T09:00:00.000Z',
  };

  const result = service.scanRows([
    {
      _id: 'evt-dpm',
      'Mã CK': 'DPM',
      'Ngày GDKHQ': '2026-09-20',
      'Ngày thực hiện': '2026-10-05',
      dividendValue: 5000,
    },
  ], new Map([['DPM', market]]), '2026-09-09T09:00:00.000Z');

  assert.equal(result.normalizedEvents, 1);
  assert.equal(result.rejectedEvents, 0);
  assert.equal(result.rejectedMarkets, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.symbol, 'DPM');
});

test('scanRows rejects malformed events and missing market snapshots', () => {
  const service = new HuntingDividendScannerService({
    getUpcoming: async () => [],
  } as never);

  const result = service.scanRows([
    { 'Mã CK': 'DPM', 'Ngày GDKHQ': 'not-a-date' },
    { 'Mã CK': 'FPT', 'Ngày GDKHQ': '2026-09-20' },
  ], new Map(), '2026-09-09T09:00:00.000Z');

  assert.equal(result.normalizedEvents, 1);
  assert.equal(result.rejectedEvents, 1);
  assert.equal(result.rejectedMarkets, 1);
  assert.equal(result.candidates.length, 0);
});

test('scanRows preserves provider-neutral scanner rejection diagnostics', () => {
  const service = new HuntingDividendScannerService({
    getUpcoming: async () => [],
  } as never);
  const market = {
    symbol: 'VIC',
    price: 100,
    averageTurnover: 10_000_000,
    averageVolume: 100_000,
    volatility: 5,
    tradable: false,
    halted: true,
    abnormalEvent: true,
    observedAt: '2026-09-09T09:00:00.000Z',
  };

  const result = service.scanRows([
    { _id: 'evt-vic', 'Mã CK': 'VIC', 'Ngày GDKHQ': '2026-09-20', dividendValue: 5000 },
  ], new Map([['VIC', market]]), '2026-09-09T09:00:00.000Z');

  assert.equal(result.candidates.length, 0);
  assert.equal(result.rejectionReasons.not_tradable, 1);
  assert.equal(result.rejectionReasons.halted, 1);
  assert.equal(result.rejectionReasons.abnormal_event, 1);
});
