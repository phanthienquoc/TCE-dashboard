import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from './api';
import { RuntimeMarketQuoteStream } from './runtime-market-quote-stream';

type Listener = (event: any) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.readyState !== FakeWebSocket.CONNECTING) return;
      this.readyState = FakeWebSocket.OPEN;
      this.emit('open', {});
    }, 0);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  receive(value: unknown): void {
    this.emit('message', { data: JSON.stringify(value) });
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState >= FakeWebSocket.CLOSING) return;
    this.readyState = FakeWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = FakeWebSocket.CLOSED;
      this.emit('close', { code, reason });
    }, 0);
  }
}

class FakeStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const eventAt = (id: string, sequence: number, seconds: number) => {
  const occurredAt = new Date(Date.UTC(2026, 9, 29, 3, 0, seconds)).toISOString();
  return {
    eventId: id,
    eventType: 'market.quote.updated',
    schemaVersion: 1,
    occurredAt,
    producer: 'ssi-feed',
    correlationId: `corr-${id}`,
    accountId: 'account-1',
    aggregateId: 'DPM',
    sequence,
    data: {
      symbol: 'DPM',
      price: 12_000 + sequence,
      timestamp: occurredAt,
      source: 'ssi',
    },
  };
};

async function withMocks(
  get: (url: string, config?: any) => Promise<any>,
  run: (storage: FakeStorage) => Promise<void>
): Promise<void> {
  const global = globalThis as any;
  const originalWindow = global.window;
  const originalStorage = global.localStorage;
  const originalWebSocket = global.WebSocket;
  const originalGet = api.get;
  const storage = new FakeStorage();

  FakeWebSocket.instances = [];
  global.window = { location: { origin: 'https://app.example.test' } };
  global.localStorage = storage;
  global.WebSocket = FakeWebSocket;
  (api as any).get = get;

  try {
    await run(storage);
  } finally {
    (api as any).get = originalGet;
    global.WebSocket = originalWebSocket;
    global.localStorage = originalStorage;
    global.window = originalWindow;
    FakeWebSocket.instances = [];
  }
}

test('does not persist a cursor until the validated quote is applied', async () => {
  await withMocks(async () => ({ data: { ok: true, data: [] } }), async storage => {
    let finishApply: (() => void) | undefined;
    const stream = new RuntimeMarketQuoteStream({
      accountId: 'account-1',
      onAuthRequired: () => assert.fail('auth should not fail'),
      onQuote: () => new Promise<void>(resolve => { finishApply = resolve; }),
    });
    const key = 'tce:runtime-events:account-1:market.quote.updated:cursor';

    stream.start();
    await tick();
    const socket = FakeWebSocket.instances[0];
    assert.ok(socket);
    assert.match(socket.url, /^wss:\/\/app\.example\.test\/api\/runtime\/events\/ws\?/);
    assert.match(socket.url, /eventType=market\.quote\.updated/);
    assert.doesNotMatch(socket.url, /token|authorization/i);

    socket.receive(eventAt('evt-1', 1, 1));
    await tick();
    assert.equal(storage.getItem(key), null);

    finishApply?.();
    await tick();
    assert.deepEqual(JSON.parse(storage.getItem(key) ?? '{}'), {
      occurredAt: eventAt('evt-1', 1, 1).occurredAt,
      eventId: 'evt-1',
    });
    stream.stop();
  });
});

test('replays persisted quotes to repair an aggregate sequence gap', async () => {
  const one = eventAt('evt-1', 1, 1);
  const two = eventAt('evt-2', 2, 2);
  const three = eventAt('evt-3', 3, 3);
  await withMocks(async (_url, config) => {
    if (config?.params?.limit === 200) return { data: { ok: true, data: [two, three] } };
    return { data: { ok: true, data: [] } };
  }, async storage => {
    const received: string[] = [];
    const stream = new RuntimeMarketQuoteStream({
      accountId: 'account-1',
      onAuthRequired: () => assert.fail('auth should not fail'),
      onQuote: event => { received.push(event.eventId); },
    });
    stream.start();
    await tick();
    const socket = FakeWebSocket.instances[0];
    socket.receive(one);
    await tick();
    socket.receive(three);
    await tick();
    await tick();

    assert.deepEqual(received, ['evt-1', 'evt-2', 'evt-3']);
    const cursor = JSON.parse(
      storage.getItem('tce:runtime-events:account-1:market.quote.updated:cursor') ?? '{}'
    );
    assert.equal(cursor.eventId, 'evt-3');
    stream.stop();
  });
});

test('terminal auth failure is handled separately from transport retry', async () => {
  await withMocks(async () => {
    throw { response: { status: 401 } };
  }, async () => {
    let authRequired = 0;
    const stream = new RuntimeMarketQuoteStream({
      accountId: 'account-1',
      onAuthRequired: () => { authRequired += 1; },
      onQuote: () => undefined,
    });
    stream.start();
    await tick();
    assert.equal(authRequired, 1);
    assert.equal(FakeWebSocket.instances.length, 0);
    stream.stop();
  });
});

test('failed quote application does not advance the durable cursor', async () => {
  await withMocks(async () => ({ data: { ok: true, data: [] } }), async storage => {
    let recoveryReason = '';
    const stream = new RuntimeMarketQuoteStream({
      accountId: 'account-1',
      onAuthRequired: () => assert.fail('auth should not fail'),
      onRecoveryRequired: reason => { recoveryReason = reason; },
      onQuote: () => { throw new Error('reducer failed'); },
    });
    stream.start();
    await tick();
    FakeWebSocket.instances[0].receive(eventAt('evt-bad-apply', 1, 1));
    await tick();
    assert.equal(storage.getItem('tce:runtime-events:account-1:market.quote.updated:cursor'), null);
    assert.equal(recoveryReason, 'quote-apply-failed');
    stream.stop();
  });
});
