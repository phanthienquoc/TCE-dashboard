import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMarketPricePayload } from './market-price-validation';

test('normalizes valid requested symbols and positive finite numeric prices', () => {
  const result = normalizeMarketPricePayload(
    [
      { symbol: ' dpm ', price: 42.5, tradingDate: '2026-10-30' },
      { symbol: 'SSI', price: 31 },
    ],
    ['DPM', 'SSI']
  );

  assert.deepEqual(result, {
    prices: {
      DPM: { symbol: 'DPM', price: 42.5, tradingDate: '2026-10-30' },
      SSI: { symbol: 'SSI', price: 31 },
    },
    acceptedCount: 2,
    rejectedCount: 0,
  });
});

test('rejects malformed, non-positive, non-finite, and unrequested quotes', () => {
  const result = normalizeMarketPricePayload(
    [
      { symbol: 'DPM', price: 0 },
      { symbol: 'SSI', price: -1 },
      { symbol: 'GAS', price: Number.POSITIVE_INFINITY },
      { symbol: 'CTG', price: Number.NaN },
      { symbol: 'MBB', price: '28.4' },
      { symbol: 'UNKNOWN', price: 12 },
      { symbol: '', price: 12 },
      { symbol: 'DPM', price: 12, tradingDate: 20261030 },
      null,
      ['SSI', 31],
    ],
    ['DPM', 'SSI', 'GAS', 'CTG', 'MBB']
  );

  assert.deepEqual(result, {
    prices: {},
    acceptedCount: 0,
    rejectedCount: 10,
  });
});

test('does not let an unexpected response shape enter the price store', () => {
  assert.deepEqual(normalizeMarketPricePayload({ DPM: 42.5 }, ['DPM']), {
    prices: {},
    acceptedCount: 0,
    rejectedCount: 1,
  });
});

test('a later valid quote replaces an earlier quote for the same requested symbol', () => {
  const result = normalizeMarketPricePayload(
    [
      { symbol: 'DPM', price: 40 },
      { symbol: 'dpm', price: 42 },
    ],
    ['DPM']
  );

  assert.equal(result.prices.DPM.price, 42);
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.rejectedCount, 0);
});
