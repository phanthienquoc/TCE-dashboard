import { strict as assert } from 'node:assert';
import test from 'node:test';
import { confirmDividendPayment } from './dividend-payment-confirmation';

const base = {
  positionState: 'T2_PENDING' as const,
  dividendLifecycle: 'T2_PENDING' as const,
  authoritative: true,
  positionSymbol: 'DPM',
  eventSymbol: 'DPM',
  eventId: 'evt-1',
  observedAt: '2026-09-14T09:00:00.000Z',
  paymentAt: '2026-09-14T08:00:00.000Z',
  paymentConfirmed: true,
  paymentEvidenceAt: '2026-09-14T07:30:00.000Z',
  paymentEvidenceSource: 'provider-confirmation',
};

test('confirms payment from explicit evidence', () => {
  const result = confirmDividendPayment(base);
  assert.equal(result.positionState, 'AVAILABLE');
  assert.equal(result.dividendLifecycle, 'DIVIDEND_CONFIRMED');
  assert.equal(result.confirmed, true);
  assert.equal(result.transitioned, true);
  assert.equal(result.late, false);
  assert.equal(result.reason, 'DIVIDEND_PAYMENT_CONFIRMED');
});

test('marks explicit evidence after expected payment as late but still confirms', () => {
  const result = confirmDividendPayment({
    ...base,
    paymentEvidenceAt: '2026-09-14T08:30:00.000Z',
  });
  assert.equal(result.confirmed, true);
  assert.equal(result.late, true);
  assert.equal(result.reason, 'DIVIDEND_PAYMENT_CONFIRMED_LATE');
});

test('fails closed when payment evidence is missing', () => {
  const result = confirmDividendPayment({
    ...base,
    paymentConfirmed: false,
    paymentEvidenceAt: undefined,
    paymentEvidenceSource: undefined,
  });
  assert.equal(result.confirmed, false);
  assert.equal(result.transitioned, false);
  assert.equal(result.reason, 'PAYMENT_CONFIRMATION_EVIDENCE_REQUIRED');
});

test('fails closed when reconciliation is not authoritative', () => {
  const result = confirmDividendPayment({ ...base, authoritative: false });
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, 'AUTHORITATIVE_RECONCILIATION_REQUIRED');
});

test('fails closed for symbol mismatch', () => {
  const result = confirmDividendPayment({ ...base, eventSymbol: 'SSI' });
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, 'DIVIDEND_EVENT_POSITION_MISMATCH');
});

test('fails closed for malformed evidence timestamp', () => {
  const result = confirmDividendPayment({ ...base, paymentEvidenceAt: 'not-a-date' });
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, 'INVALID_PAYMENT_EVIDENCE_TIMESTAMP');
});

test('fails closed when evidence is newer than the observation', () => {
  const result = confirmDividendPayment({
    ...base,
    paymentEvidenceAt: '2026-09-14T09:01:00.000Z',
  });
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, 'PAYMENT_EVIDENCE_AFTER_OBSERVATION');
});

test('fails closed for malformed expected payment timestamp', () => {
  const result = confirmDividendPayment({ ...base, paymentAt: 'not-a-date' });
  assert.equal(result.confirmed, false);
  assert.equal(result.reason, 'INVALID_PAYMENT_TIMESTAMP');
});
