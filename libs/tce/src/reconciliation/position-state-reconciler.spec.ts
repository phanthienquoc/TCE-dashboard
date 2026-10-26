import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reconcilePositionState,
  type LocalPosition,
  type ProviderPosition,
} from './position-state-reconciler';

const local = (overrides: Partial<LocalPosition> = {}): LocalPosition => ({
  id: 'slot-1',
  symbol: 'DPM',
  quantity: 100,
  avgCost: 30000,
  currentPrice: 31500,
  targetPrice: 31500,
  status: 'OPEN',
  slotId: 'slot-1',
  pool: 'A',
  ...overrides,
});

const provider = (overrides: Partial<ProviderPosition> = {}): ProviderPosition => ({
  symbol: ' dpm ',
  quantity: 100,
  averagePrice: 30000,
  marketPrice: 31500,
  sellableQuantity: 100,
  ...overrides,
});

test('converges normalized local/provider holdings and marks complete exit data', () => {
  const result = reconcilePositionState([local()], [provider()]);

  assert.equal(result.complete, true);
  assert.equal(result.exitDataComplete, true);
  assert.equal(result.positions[0]?.symbol, 'DPM');
  assert.equal(result.positions[0]?.disposition, 'CONVERGED');
  assert.equal(result.positions[0]?.exitDataComplete, true);
});

test('reports missing and unexpected holdings without auto-closing or auto-adopting', () => {
  const result = reconcilePositionState(
    [local()],
    [provider({ symbol: 'VNM' })]
  );

  assert.equal(result.complete, false);
  assert.deepEqual(result.missingProviderSymbols, ['DPM']);
  assert.deepEqual(result.unexpectedProviderSymbols, ['VNM']);
  assert.equal(result.positions.every(item => item.disposition !== 'CONVERGED'), true);
});

test('fails closed when quantity or average price differs', () => {
  const quantityMismatch = reconcilePositionState(
    [local()],
    [provider({ quantity: 90, sellableQuantity: 90 })]
  );
  assert.equal(quantityMismatch.positions[0]?.disposition, 'MISMATCH');
  assert.equal(quantityMismatch.positions[0]?.quantityDelta, -10);

  const priceMismatch = reconcilePositionState(
    [local()],
    [provider({ averagePrice: 31000 })]
  );
  assert.equal(priceMismatch.positions[0]?.disposition, 'MISMATCH');
  assert.equal(priceMismatch.positions[0]?.averagePriceDelta, 1000);
});

test('fails closed on duplicate normalized symbols from either source', () => {
  const duplicateLocal = reconcilePositionState(
    [local(), local({ id: 'slot-2', symbol: ' dpm ' })],
    [provider()]
  );
  assert.deepEqual(duplicateLocal.ambiguousSymbols, ['DPM']);
  assert.equal(duplicateLocal.positions[0]?.disposition, 'AMBIGUOUS');

  const duplicateProvider = reconcilePositionState(
    [local()],
    [provider(), provider({ symbol: 'DPM' })]
  );
  assert.deepEqual(duplicateProvider.ambiguousSymbols, ['DPM']);
  assert.equal(duplicateProvider.positions[0]?.disposition, 'AMBIGUOUS');
});

test('invalid provider quantities are reconciliation-required and never exit-complete', () => {
  const result = reconcilePositionState(
    [local()],
    [provider({ quantity: Number.NaN })]
  );

  assert.equal(result.complete, false);
  assert.deepEqual(result.invalidSymbols, ['DPM']);
  assert.equal(result.positions.some(item => item.disposition === 'RECONCILIATION_REQUIRED'), true);
  assert.equal(result.exitDataComplete, false);
});

test('missing sellability, target or market price blocks exit data readiness', () => {
  const noSellability = reconcilePositionState(
    [local()],
    [provider({ sellableQuantity: undefined })]
  );
  assert.equal(noSellability.complete, true);
  assert.equal(noSellability.exitDataComplete, false);

  const noTarget = reconcilePositionState(
    [local({ targetPrice: undefined })],
    [provider()]
  );
  assert.equal(noTarget.complete, true);
  assert.equal(noTarget.exitDataComplete, false);

  const noMarketPrice = reconcilePositionState(
    [local()],
    [provider({ marketPrice: undefined })]
  );
  assert.equal(noMarketPrice.complete, true);
  assert.equal(noMarketPrice.exitDataComplete, false);
});

test('returns deterministic symbol ordering without mutating either input', () => {
  const locals = [local({ symbol: 'VNM', id: 'slot-vnm' }), local()];
  const providers = [provider({ symbol: 'VNM' }), provider()];
  const localsBefore = structuredClone(locals);
  const providersBefore = structuredClone(providers);

  const result = reconcilePositionState(locals, providers);

  assert.deepEqual(result.positions.map(item => item.symbol), ['DPM', 'VNM']);
  assert.deepEqual(locals, localsBefore);
  assert.deepEqual(providers, providersBefore);
});
