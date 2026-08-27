import { USDMClient } from 'binance';
import { BinanceFuturesExecutionAdapter } from './binance.futures.execution.adapter';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';

const originalCancel = USDMClient.prototype.cancelOrder;
afterEach(() => { USDMClient.prototype.cancelOrder = originalCancel; });

test('cancelOrder rejects missing identifiers without touching Binance', async () => {
  let called = false;
  USDMClient.prototype.cancelOrder = async function () { called = true; return {} as never; };
  const result = await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).cancelOrder({ symbol: 'BTCUSDT' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_INPUT');
  assert.equal(called, false);
});

test('cancelOrder maps orderId and symbol correctly', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.cancelOrder = async function (params) { received = params as Record<string, unknown>; return { orderId: 123, clientOrderId: 'tce-order', symbol: 'BTCUSDT', status: 'CANCELED' }; };
  const result = await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).cancelOrder({ symbol: 'btcusdt', orderId: '123' });
  assert.equal(result.ok, true);
  assert.deepEqual(received, { symbol: 'BTCUSDT', orderId: 123, origClientOrderId: undefined });
  if (result.ok) assert.equal(result.data.status, 'CANCELED');
});
