import test from 'node:test';
import assert from 'node:assert/strict';
import type { TceDividendEvent } from '@tce/contracts';
import type { AuthoritativeProjection } from '../reconciliation/authoritative-position-projection';
import { evaluateDividendHoldingEligibility } from './dividend-holding-eligibility';

const event: TceDividendEvent = {
  id: 'div-1',
  symbol: 'VNM',
  dividendType: 'CASH',
  exDividendAt: '2026-09-14T02:00:00.000Z',
  source: 'test',
};

const projection: AuthoritativeProjection = {
  authoritative: true,
  holdings: [
    {
      id: 'pos-1',
      symbol: 'vnm',
      quantity: 100,
      avgCost: 70,
      currentPrice: 75,
      status: 'HOLDING',
      costBasis: 7000,
      unrealizedPnl: 500,
    },
  ],
};

test('accepts an authoritative HOLDING at the ex-dividend boundary', () => {
  const result = evaluateDividendHoldingEligibility(projection, event, event.exDividendAt);
  assert.equal(result.eligible, true);
  assert.equal(result.holding?.symbol, 'VNM');
});

test('rejects a holding before the ex-dividend boundary', () => {
  const result = evaluateDividendHoldingEligibility(projection, event, '2026-09-14T01:59:59.999Z');
  assert.equal(result.eligible, false);
  assert.match(result.reason, /not ex-dividend yet/);
});

test('fails closed when reconciliation is not authoritative', () => {
  const result = evaluateDividendHoldingEligibility(
    { authoritative: false, holdings: [], reason: 'ambiguous' },
    event,
    event.exDividendAt
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /reconciliation is required/);
});

test('rejects a dividend event without a matching holding', () => {
  const result = evaluateDividendHoldingEligibility(
    projection,
    { ...event, symbol: 'FPT' },
    event.exDividendAt
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /No authoritative HOLDING matches/);
});

test('rejects zero-quantity authoritative holdings', () => {
  const result = evaluateDividendHoldingEligibility(
    {
      authoritative: true,
      holdings: [{ ...projection.holdings[0], quantity: 0 }],
    },
    event,
    event.exDividendAt
  );
  assert.equal(result.eligible, false);
  assert.match(result.reason, /quantity is invalid/);
});

test('fails closed on malformed event or observation timestamps', () => {
  const malformed = evaluateDividendHoldingEligibility(
    projection,
    { ...event, exDividendAt: 'not-a-date' },
    event.exDividendAt
  );
  assert.equal(malformed.eligible, false);

  const malformedObservation = evaluateDividendHoldingEligibility(projection, event, 'not-a-date');
  assert.equal(malformedObservation.eligible, false);
});
