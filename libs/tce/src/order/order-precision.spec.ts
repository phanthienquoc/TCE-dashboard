import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOrderPrices, roundPriceToTick, roundQuantityToStep } from './order-precision';

test('rounds prices down to the configured tick deterministically', () => {
  const result = roundPriceToTick(28_537, 100);
  assert.deepEqual(result, { ok: true, value: 28_500 });
});

test('rounds quantities down to the configured step', () => {
  const result = roundQuantityToStep(1_249, 100);
  assert.deepEqual(result, { ok: true, value: 1_200 });
});

test('normalizes entry, target and invalidation using the same price tick', () => {
  const result = normalizeOrderPrices(28_537, 29_987, 27_901, {
    priceTick: 100,
    quantityStep: 100,
  });
  assert.deepEqual(result, {
    ok: true,
    value: { entry: 28_500, target: 29_900, invalidation: 27_900 },
  });
});

test('rejects invalid precision configuration and values', () => {
  assert.equal(roundPriceToTick(28_500, 0).ok, false);
  assert.equal(roundQuantityToStep(1_000, 0).ok, false);
  assert.equal(roundQuantityToStep(50, 100).ok, false);
});
