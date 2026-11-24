import assert from 'node:assert/strict';
import test from 'node:test';

import { collectDistinctDividendSymbols } from './dividend-symbols';

test('paginates the full stock-event universe and returns normalized unique symbols', async () => {
  const calls: Array<{ from: number; to: number }> = [];
  const pages = new Map([
    [0, [{ symbol: 'dpm' }, { symbol: ' DPM ' }]],
    [2, [{ symbol: 'pnj' }, { symbol: null }]],
    [4, [{ symbol: 'vix' }]],
  ]);

  const symbols = await collectDistinctDividendSymbols(
    async (from, to) => {
      calls.push({ from, to });
      return pages.get(from) ?? [];
    },
    2
  );

  assert.deepEqual(calls, [
    { from: 0, to: 1 },
    { from: 2, to: 3 },
    { from: 4, to: 5 },
  ]);
  assert.deepEqual(symbols, ['DPM', 'PNJ', 'VIX']);
});

test('returns an empty universe when the source has no rows', async () => {
  const calls: number[] = [];
  const symbols = await collectDistinctDividendSymbols(async from => {
    calls.push(from);
    return [];
  });

  assert.deepEqual(calls, [0]);
  assert.deepEqual(symbols, []);
});

test('rejects invalid page sizes and propagates page errors', async () => {
  await assert.rejects(
    collectDistinctDividendSymbols(async () => [], 0),
    RangeError
  );
  await assert.rejects(
    collectDistinctDividendSymbols(async () => {
      throw new Error('page fetch failed');
    }),
    /page fetch failed/
  );
});
