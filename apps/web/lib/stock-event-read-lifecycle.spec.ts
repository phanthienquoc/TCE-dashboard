import assert from 'node:assert/strict';
import test from 'node:test';

import { startStockEventRead, type StockEventLoader } from './stock-event-read-lifecycle';

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

test('dividend-position event read preserves its refresh arguments and aborts on cleanup', () => {
  const captured = captureLoader();
  const cleanup = startStockEventRead({ limit: 2000, force: true, month: null }, captured.load);

  const request = captured.getRequest();
  assert.ok(request);
  assert.equal(request.limit, 2000);
  assert.equal(request.force, true);
  assert.equal(request.month, null);
  assert.equal(request.signal.aborted, false);

  cleanup();

  assert.equal(request.signal.aborted, true);
});

test('dashboard positions event read preserves its request arguments and aborts on cleanup', () => {
  const captured = captureLoader();
  const cleanup = startStockEventRead({ limit: 200, force: false, month: null }, captured.load);

  const request = captured.getRequest();
  assert.ok(request);
  assert.equal(request.limit, 200);
  assert.equal(request.force, false);
  assert.equal(request.month, null);
  assert.equal(request.signal.aborted, false);

  cleanup();

  assert.equal(request.signal.aborted, true);
});
