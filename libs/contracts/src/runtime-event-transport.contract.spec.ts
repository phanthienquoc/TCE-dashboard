import assert from 'node:assert/strict';
import test from 'node:test';
import { isTceApiError, type TceApiError } from './runtime-event-transport.contract';

test('accepts a canonical runtime API error', () => {
  const error: TceApiError = {
    ok: false,
    error: {
      code: 'RUNTIME_EVENT_STORE_UNAVAILABLE',
      message: 'Runtime event store is unavailable',
      retryable: true,
    },
  };
  assert.equal(isTceApiError(error), true);
});

test('rejects incomplete or non-error API responses', () => {
  assert.equal(isTceApiError({ ok: true, data: [] }), false);
  assert.equal(isTceApiError({ ok: false, error: { code: '', message: 'bad' } }), false);
  assert.equal(isTceApiError(null), false);
});
