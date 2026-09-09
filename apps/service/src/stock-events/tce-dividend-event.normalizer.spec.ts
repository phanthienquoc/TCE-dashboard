import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTceDividendEvent } from './tce-dividend-event.normalizer';

test('normalizes a stock dividend event into a provider-neutral TCE event', () => {
  const event = normalizeTceDividendEvent({
    _id: 'evt-123',
    'Mã CK': 'DPM',
    'Ngày GDKHQ': '2026-09-20',
    'Ngày thực hiện': '2026-10-05',
    'Tỷ lệ': '10%',
    dividendValue: '1500',
  });

  assert.deepEqual(event, {
    id: 'evt-123',
    symbol: 'DPM',
    dividendType: 'CASH',
    dividendValue: 1500,
    dividendYield: undefined,
    exDividendAt: '2026-09-20T00:00:00.000Z',
    paymentAt: '2026-10-05T00:00:00.000Z',
    eligibility: [],
    source: 'stock-events',
  });
});

test('uses a deterministic fallback identity when provider id is absent', () => {
  const input = {
    symbol: 'FPT',
    'Ngày GDKHQ': '2026-09-20',
    'Tỷ lệ': '5%',
  };

  const first = normalizeTceDividendEvent(input);
  const second = normalizeTceDividendEvent(input);

  assert.equal(first?.id, 'dividend:FPT:2026-09-20T00:00:00.000Z:5%');
  assert.equal(first?.id, second?.id);
});

test('rejects events without a valid symbol or ex-dividend date', () => {
  assert.equal(normalizeTceDividendEvent({ 'Ngày GDKHQ': '2026-09-20' }), null);
  assert.equal(normalizeTceDividendEvent({ symbol: 'DPM', 'Ngày GDKHQ': 'not-a-date' }), null);
});
