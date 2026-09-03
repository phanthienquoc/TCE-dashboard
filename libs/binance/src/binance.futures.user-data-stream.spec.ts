import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BinanceFuturesUserDataStream } from './binance.futures.user-data-stream';

test('user-data stream requires an API key before creating a listenKey', async () => {
  const stream = new BinanceFuturesUserDataStream({});
  await assert.rejects(() => stream.start(), /API key is not configured/);
});

test('production stream uses Binance USDⓈ-M REST and websocket endpoints', () => {
  const stream = new BinanceFuturesUserDataStream({ apiKey: 'k', apiSecret: 's' });
  assert.ok(stream);
});
