import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDividendEventAnomaly } from './dividend-event-anomaly';

const expectedPaymentAt = '2026-09-20T00:00:00.000Z';

test('keeps missing payment evidence pending before expected payment', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: false,
    expectedPaymentAt,
    observedAt: '2026-09-19T00:00:00.000Z',
  });
  assert.equal(result.status, 'MISSING_PENDING');
  assert.equal(result.actionable, false);
});

test('marks missing payment evidence as missed at the payment boundary', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: false,
    expectedPaymentAt,
    observedAt: expectedPaymentAt,
  });
  assert.equal(result.status, 'MISSING_MISSED');
  assert.equal(result.actionable, false);
});

test('accepts explicit late payment evidence without provider mutation', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-22T00:00:00.000Z',
    paymentEvidenceAt: '2026-09-21T00:00:00.000Z',
  });
  assert.equal(result.status, 'LATE_CONFIRMED');
  assert.equal(result.late, true);
  assert.equal(result.actionable, true);
});

test('fails closed when evidence is newer than observation', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-21T00:00:00.000Z',
    paymentEvidenceAt: '2026-09-22T00:00:00.000Z',
  });
  assert.equal(result.status, 'MISSING_PENDING');
  assert.equal(result.actionable, false);
});

test('fails closed without authoritative reconciliation', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: false,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-21T00:00:00.000Z',
    paymentEvidenceAt: '2026-09-20T00:00:00.000Z',
  });
  assert.equal(result.reason, 'AUTHORITATIVE_RECONCILIATION_REQUIRED');
  assert.equal(result.actionable, false);
});

test('requires explicit payment evidence for a present event', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-20T00:00:00.000Z',
  });
  assert.equal(result.reason, 'EXPLICIT_PAYMENT_EVIDENCE_REQUIRED');
  assert.equal(result.actionable, false);
});

test('projects split adjustment but requires authoritative reconciliation', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-20T00:00:00.000Z',
    paymentEvidenceAt: '2026-09-20T00:00:00.000Z',
    corporateAction: { type: 'SPLIT', numerator: 2, denominator: 1 },
    holdingQuantity: 100,
    holdingAveragePrice: 50,
  });
  assert.equal(result.status, 'CORPORATE_ACTION_RECONCILIATION_REQUIRED');
  assert.equal(result.actionable, false);
  assert.equal(result.adjustedQuantity, 200);
  assert.equal(result.adjustedAveragePrice, 25);
});

test('rejects invalid corporate-action ratios and position values', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: true,
    expectedPaymentAt,
    observedAt: '2026-09-20T00:00:00.000Z',
    corporateAction: { type: 'BONUS', numerator: 0, denominator: 1 },
    holdingQuantity: 100,
    holdingAveragePrice: 50,
  });
  assert.equal(result.reason, 'INVALID_CORPORATE_ACTION_RECONCILIATION_INPUT');
  assert.equal(result.actionable, false);
});

test('fails closed on malformed timestamps', () => {
  const result = reconcileDividendEventAnomaly({
    authoritative: true,
    eventPresent: false,
    expectedPaymentAt: 'not-a-date',
    observedAt: '2026-09-20T00:00:00.000Z',
  });
  assert.equal(result.reason, 'INVALID_PAYMENT_TIMESTAMP');
  assert.equal(result.actionable, false);
});
