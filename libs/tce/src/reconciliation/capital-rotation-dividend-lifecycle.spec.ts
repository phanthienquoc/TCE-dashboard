import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CapitalRotationDividendLifecycle,
  expectedT2Window,
} from './capital-rotation-dividend-lifecycle';

const base = {
  positionId: 'position-1',
  symbol: 'DPM',
  quantity: 100,
  avgCost: 100,
  currentPrice: 102,
  dividendPerShare: 5,
  exDividendAt: '2026-09-20T00:00:00.000Z',
  paymentAt: '2026-09-22T00:00:00.000Z',
  dividendLifecycle: 'ELIGIBLE' as const,
  state: 'HOLDING' as const,
  updatedAt: '2026-09-18T02:00:00.000Z',
};

test('CRDE lifecycle follows HOLDING → EX_DIVIDEND → T2_PENDING → DIVIDEND_CONFIRMED', () => {
  const lifecycle = new CapitalRotationDividendLifecycle();

  const ex = lifecycle.transition(
    base,
    'EX_DIVIDEND',
    { correlationId: 'corr-1', idempotencyKey: 'life-1' },
    'ex-date-reached',
    { exDividendAt: base.exDividendAt, paymentAt: base.paymentAt }
  );
  assert.equal(ex.ok, true);
  if (!ex.ok) return;
  assert.equal(ex.position.state, 'EX_DIVIDEND');

  const t2 = lifecycle.transition(
    ex.position,
    'T2_PENDING',
    { correlationId: 'corr-1', idempotencyKey: 'life-2' },
    'filled-position-awaiting-settlement'
  );
  assert.equal(t2.ok, true);
  if (!t2.ok) return;
  assert.equal(t2.position.state, 'T2_PENDING');

  const confirmed = lifecycle.transition(
    { ...t2.position, paymentAt: '2026-09-01T00:00:00.000Z' },
    'DIVIDEND_CONFIRMED',
    { correlationId: 'corr-1', idempotencyKey: 'life-3' },
    'cash-dividend-confirmed',
    { netCash: 475 }
  );
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.position.state, 'DIVIDEND_CONFIRMED');
  assert.equal(confirmed.event.dividendEvidence?.netCash, 475);
});

test('CRDE lifecycle blocks dividend confirmation before payment is due', () => {
  const lifecycle = new CapitalRotationDividendLifecycle();
  const result = lifecycle.transition(
    { ...base, state: 'T2_PENDING', dividendLifecycle: 'T2_PENDING' },
    'DIVIDEND_CONFIRMED',
    { correlationId: 'corr-2', idempotencyKey: 'life-4' },
    'premature-confirmation'
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'PAYMENT_NOT_DUE');
});

test('CRDE lifecycle rejects invalid jumps and supports idempotent replay', () => {
  const lifecycle = new CapitalRotationDividendLifecycle();
  const invalid = lifecycle.transition(
    base,
    'DIVIDEND_CONFIRMED',
    { correlationId: 'corr-3', idempotencyKey: 'life-5' },
    'invalid-jump'
  );
  assert.equal(invalid.ok, false);

  const first = lifecycle.transition(
    base,
    'EX_DIVIDEND',
    { correlationId: 'corr-3', idempotencyKey: 'life-6' },
    'ex-date-reached'
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = lifecycle.transition(
    base,
    'EX_DIVIDEND',
    { correlationId: 'corr-3', idempotencyKey: 'life-6' },
    'different-reason'
  );
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.event.reason, 'idempotent_replay');
});

test('expected T+2 window is deterministic', () => {
  assert.equal(expectedT2Window('2026-09-20T00:00:00.000Z'), '2026-09-22T00:00:00.000Z');
});
