import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRuntimeEventsWsBackpressured,
  RUNTIME_EVENTS_WS_MAX_BUFFERED_BYTES,
} from './runtime-events.websocket';

test('runtime event WebSocket pauses polling when its outbound buffer reaches the high-water mark', () => {
  assert.equal(isRuntimeEventsWsBackpressured(0), false);
  assert.equal(isRuntimeEventsWsBackpressured(RUNTIME_EVENTS_WS_MAX_BUFFERED_BYTES - 1), false);
  assert.equal(isRuntimeEventsWsBackpressured(RUNTIME_EVENTS_WS_MAX_BUFFERED_BYTES), true);
  assert.equal(isRuntimeEventsWsBackpressured(RUNTIME_EVENTS_WS_MAX_BUFFERED_BYTES + 1), true);
});
