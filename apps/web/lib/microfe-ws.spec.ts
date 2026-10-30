import assert from 'node:assert/strict';
import test from 'node:test';

import { microfeWs, reconnectDelay, type MicrofeEvent } from './microfe-ws';

type FakeEvent = {
  code?: number;
  data?: unknown;
  reason?: string;
};

type FakeListener = (event: FakeEvent) => void;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];

  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, FakeListener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: FakeListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error('Cannot send while the fake socket is not open');
    }
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', { code, reason });
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  message(value: unknown) {
    this.emit('message', { data: JSON.stringify(value) });
  }

  private emit(type: string, event: FakeEvent) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function withFakeWebSocket(run: () => void) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: FakeWebSocket,
  });
  FakeWebSocket.instances.length = 0;

  try {
    run();
  } finally {
    microfeWs.stop();
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'WebSocket', originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'WebSocket');
    }
  }
}

function event(id: string, channel: string, sequence?: number): MicrofeEvent {
  return {
    id,
    channel,
    event: 'updated',
    timestamp: '2026-10-30T00:00:00.000Z',
    ...(sequence === undefined ? {} : { sequence }),
  };
}

test('reconnect delay grows exponentially, caps the exponent, and applies injectable jitter', () => {
  assert.equal(reconnectDelay(0, () => 0), 500);
  assert.equal(reconnectDelay(1, () => 0), 1000);
  assert.equal(reconnectDelay(2, () => 0), 2000);
  assert.equal(reconnectDelay(16, () => 0), 30_000);
  assert.equal(reconnectDelay(100, () => 0), 30_000);
  assert.equal(reconnectDelay(0, () => 0.5), 550);
});

test('platform WebSocket deduplicates IDs and scopes sequence gaps to each channel', () => {
  withFakeWebSocket(() => {
    const received: MicrofeEvent[] = [];
    const gaps: Array<{ channel: string; expected: number; received: number }> = [];

    microfeWs.start({
      onEvent: item => received.push(item),
      onGap: (channel, expected, receivedSequence) =>
        gaps.push({ channel, expected, received: receivedSequence }),
    });

    const socket = FakeWebSocket.instances[0];
    assert.ok(socket);
    socket.open();

    socket.message(event('quote-10', 'quotes-day11', 10));
    socket.message(event('quote-10', 'quotes-day11', 10));
    socket.message(event('quote-12', 'quotes-day11', 12));
    socket.message(event('position-2', 'positions-day11', 2));
    socket.message(event('quote-11-late', 'quotes-day11', 11));

    assert.deepEqual(
      received.map(item => item.id),
      ['quote-10', 'quote-12', 'position-2']
    );
    assert.deepEqual(gaps, [{ channel: 'quotes-day11', expected: 11, received: 12 }]);
  });
});

test('platform WebSocket bounds recent event-ID deduplication', () => {
  withFakeWebSocket(() => {
    const received: MicrofeEvent[] = [];
    microfeWs.start({ onEvent: item => received.push(item) });

    const socket = FakeWebSocket.instances[0];
    assert.ok(socket);
    socket.open();

    for (let index = 0; index < 513; index++) {
      socket.message(event(`event-${index}`, 'bounded-day11'));
    }

    // The recent-ID cache is intentionally bounded to 512 entries.
    // Once an ID ages out, this transport-level cache can no longer dedupe it.
    socket.message(event('event-0', 'bounded-day11'));

    assert.equal(received.length, 514);
    assert.equal(received.at(-1)?.id, 'event-0');
  });
});

test('authentication close requests the session flow instead of reconnecting', () => {
  withFakeWebSocket(() => {
    let authRequiredCalls = 0;
    microfeWs.start({ onAuthRequired: () => authRequiredCalls++ });

    const socket = FakeWebSocket.instances[0];
    assert.ok(socket);
    socket.open();
    socket.close(4401, 'unauthorized');

    assert.equal(authRequiredCalls, 1);
    assert.equal(FakeWebSocket.instances.length, 1);
  });
});
