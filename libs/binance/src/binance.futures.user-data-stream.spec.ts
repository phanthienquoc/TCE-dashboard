import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BinanceFuturesUserDataStream } from './binance.futures.user-data-stream';

test('user-data stream requires an API key before creating a listenKey', async () => {
  const stream = new BinanceFuturesUserDataStream({});
  await assert.rejects(() => stream.start(), /API key is not configured/);
});

test('user-data stream can be constructed for production and testnet', () => {
  assert.ok(new BinanceFuturesUserDataStream({ apiKey: 'k', apiSecret: 's' }, 'production'));
  assert.ok(new BinanceFuturesUserDataStream({ apiKey: 'k', apiSecret: 's' }, 'testnet'));
});
