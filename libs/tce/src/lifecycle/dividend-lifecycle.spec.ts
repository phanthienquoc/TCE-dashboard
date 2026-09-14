import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDividendLifecycleTransition,
  isDividendEligibilityWindowOpen,
  resolveDividendLifecycle,
} from './dividend-lifecycle';
import type { TceDividendEvent } from '@tce/contracts';

const event: TceDividendEvent = {
  id: 'evt-1',
  symbol: 'VNM',
  dividendType: 'CASH',
  exDividendAt: '2026-09-20T00:00:00.000Z',
  recordAt: '2026-09-21T00:00:00.000Z',
  paymentAt: '2026-10-05T00:00:00.000Z',
  eligibility: ['HOLDING_AT_EX_DATE'],
  source: 'stock-events',
};

test('resolves deterministic pre-ex lifecycle states', () => {
  assert.equal(resolveDividendLifecycle(event, '2026-09-10T00:00:00.000Z'), 'ELIGIBLE');
  assert.equal(isDividendEligibilityWindowOpen(event, '2026-09-10T00:00:00.000Z'), true);
});

test('resolves ex-dividend and confirmed lifecycle states', () => {
  assert.equal(resolveDividendLifecycle(event, '2026-09-20T00:00:00.000Z'), 'EX_DIVIDEND');
  assert.equal(resolveDividendLifecycle(event, '2026-10-05T00:00:00.000Z'), 'DIVIDEND_CONFIRMED');
  assert.equal(isDividendEligibilityWindowOpen(event, '2026-09-20T00:00:00.000Z'), false);
});

test('rejects invalid lifecycle transitions', () => {
  assert.doesNotThrow(() => assertDividendLifecycleTransition('ANNOUNCED', 'ELIGIBLE'));
  assert.throws(() => assertDividendLifecycleTransition('DIVIDEND_CONFIRMED', 'EX_DIVIDEND'));
});

test('fails closed for malformed lifecycle dates', () => {
  assert.equal(resolveDividendLifecycle({ ...event, exDividendAt: 'bad-date' }, '2026-09-10T00:00:00.000Z'), 'INVALIDATED');
  assert.equal(resolveDividendLifecycle({ ...event, paymentAt: 'bad-date' }, '2026-09-10T00:00:00.000Z'), 'INVALIDATED');
});
