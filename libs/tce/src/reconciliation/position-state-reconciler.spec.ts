import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcilePositionStates } from './position-state-reconciler';

test('converges when local and provider positions match', () => {
  const [delta] = reconcilePositionStates(
    [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
    [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }]
  );

  assert.ok(delta);
  assert.equal(delta.symbol, 'DPM');
  assert.equal(delta.disposition, 'CONVERGED');
});

test('uses provider quantity and average cost as authoritative updates', () => {
  const [delta] = reconcilePositionStates(
    [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
    [{ symbol: 'DPM', quantity: 120, avgCost: 29900 }]
  );

  assert.ok(delta);
  assert.equal(delta.symbol, 'DPM');
  assert.equal(delta.disposition, 'UPDATED');
  assert.equal(delta.providerQuantity, 120);
  assert.equal(delta.providerAvgCost, 29900);
});

test('fails closed for a missing provider holding', () => {
  const [delta] = reconcilePositionStates(
    [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
    []
  );

  assert.ok(delta);
  assert.equal(delta.disposition, 'MISSING_PROVIDER_POSITION');
});

test('reports unexpected provider holdings without auto-adopting them', () => {
  const [delta] = reconcilePositionStates(
    [],
    [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }]
  );

  assert.ok(delta);
  assert.equal(delta.disposition, 'UNEXPECTED_PROVIDER_POSITION');
});

test('fails closed for invalid or duplicate provider truth', () => {
  const deltas = reconcilePositionStates(
    [],
    [
      { symbol: 'DPM', quantity: 100, avgCost: 30000 },
      { symbol: 'DPM', quantity: 50, avgCost: 30000 },
    ]
  );

  assert.ok(deltas[1]);
  assert.equal(deltas[1].disposition, 'RECONCILIATION_REQUIRED');
});
