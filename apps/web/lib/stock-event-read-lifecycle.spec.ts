import assert from 'node:assert/strict';
import test from 'node:test';

import { startStockEventRead, type StockEventLoader } from './stock-event-read-lifecycle';
import { STOCK_EVENTS_READ_LIMIT } from './stock-event-store';

function captureLoader() {
  let request:
    | {
        limit: number;
        force: boolean;
        month: string | null;
        signal: AbortSignal;
      }
    | undefined;

  const load: StockEventLoader = async (limit, force, month, signal) => {
    request = { limit, force, month, signal };
  };

  return { load, getRequest: () => request };
}

test('dividend-position event read uses the supported limit and aborts on cleanup', () => {
  const captured = captureLoader();
  const cleanup = startStockEventRead(
    { limit: STOCK_EVENTS_READ_LIMIT, force: true, month: null },
    captured.load
  );

  const request = captured.getRequest();
  assert.ok(request);
  assert.equal(request.limit, STOCK_EVENTS_READ_LIMIT);
  assert.equal(request.limit, 200);
  assert.equal(request.force, true);
  assert.equal(request.month, null);
  assert.equal(request.signal.aborted, false);

  cleanup();

  assert.equal(request.signal.aborted, true);
});

test('dashboard positions event read preserves its request arguments and aborts on cleanup', () => {
  const captured = captureLoader();
  const cleanup = startStockEventRead(
    { limit: STOCK_EVENTS_READ_LIMIT, force: false, month: null },
    captured.load
  );

  const request = captured.getRequest();
  assert.ok(request);
  assert.equal(request.limit, 200);
  assert.equal(request.force, false);
  assert.equal(request.month, null);
  assert.equal(request.signal.aborted, false);

  cleanup();

  assert.equal(request.signal.aborted, true);
});
