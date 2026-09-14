import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileDividendSettlementAvailability } from './dividend-settlement-reconciliation';

const position = {
  state: 'T2_PENDING' as const,
  symbol: 'VNM',
  quantity: 100,
  availableAt: '2026-09-14T10:00:00.000Z',
};
const holding = { symbol: 'VNM', quantity: 100, status: 'HOLDING' as const };

 test('does not mark T2_PENDING available before the settlement boundary', () => {
  assert.equal(
    reconcileDividendSettlementAvailability(position, holding, new Date('2026-09-14T09:59:59.999Z')).ok,
    false
  );
});

test('marks T2_PENDING available at the exact settlement boundary', () => {
  assert.deepEqual(
    reconcileDividendSettlementAvailability(position, holding, new Date('2026-09-14T10:00:00.000Z')),
    { ok: true, state: 'AVAILABLE', symbol: 'VNM', quantity: 100 }
  );
});

test('fails closed when the authoritative holding is missing', () => {
  assert.deepEqual(
    reconcileDividendSettlementAvailability(position, undefined, new Date('2026-09-14T10:00:00.000Z')),
    { ok: false, reason: 'Authoritative HOLDING position is missing.' }
  );
});

test('fails closed when symbol or quantity no longer reconciles', () => {
  assert.equal(
    reconcileDividendSettlementAvailability(position, { ...holding, symbol: 'FPT' }, new Date('2026-09-14T10:00:00.000Z')).ok,
    false
  );
  assert.equal(
    reconcileDividendSettlementAvailability(position, { ...holding, quantity: 99 }, new Date('2026-09-14T10:00:00.000Z')).ok,
    false
  );
});

test('fails closed on malformed settlement timestamps and invalid observation time', () => {
  assert.equal(
    reconcileDividendSettlementAvailability({ ...position, availableAt: 'not-a-date' }, holding, new Date('2026-09-14T10:00:00.000Z')).ok,
    false
  );
  assert.equal(
    reconcileDividendSettlementAvailability(position, holding, new Date('invalid')).ok,
    false
  );
});
