import assert from 'node:assert/strict';
import test from 'node:test';

import { startDividendPositionsEventRead } from './dividend-positions-read-lifecycle';

test('dividend-position event read forwards its lifecycle signal and aborts on cleanup', () => {
  let request:
    | {
        limit: number;
        force: boolean;
        month: null;
        signal: AbortSignal;
      }
    | undefined;

  const cleanup = startDividendPositionsEventRead(async (limit, force, month, signal) => {
    request = { limit, force, month, signal };
  });

  assert.ok(request);
  assert.equal(request.limit, 2000);
  assert.equal(request.force, true);
  assert.equal(request.month, null);
  assert.equal(request.signal.aborted, false);

  cleanup();

  assert.equal(request.signal.aborted, true);
});
