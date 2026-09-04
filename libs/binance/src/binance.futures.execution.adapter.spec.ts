import { USDMClient } from 'binance';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { BinanceFuturesExecutionAdapter } from './binance.futures.execution.adapter';

const originalSubmit = USDMClient.prototype.submitNewOrder;
const originalBalance = USDMClient.prototype.getBalance;
const originalCancel = USDMClient.prototype.cancelOrder;

afterEach(() => {
  USDMClient.prototype.submitNewOrder = originalSubmit;
  USDMClient.prototype.getBalance = originalBalance;
  USDMClient.prototype.cancelOrder = originalCancel;
});

test('testConnection rejects missing credentials without touching Binance', async () => {
  let called = false;
  USDMClient.prototype.getBalance = async function () {
    called = true;
    return [];
  };
  const result = await new BinanceFuturesExecutionAdapter({}).testConnection();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.equal(called, false);
});

test('testConnection uses Binance private API and identifies testnet', async () => {
  USDMClient.prototype.getBalance = async function () {
    return [{ asset: 'USDT', balance: '100' }] as any;
  } as any;
  const result = await new BinanceFuturesExecutionAdapter(
    { apiKey: 'test-key', apiSecret: 'test-secret' },
    'testnet'
  ).testConnection();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.connected, true);
    assert.equal(result.data.environment, 'testnet');
    assert.equal(result.data.balances.length, 1);
  }
});

test('production is the default Binance environment', async () => {
  USDMClient.prototype.getBalance = async function () {
    return [] as any;
  } as any;
  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'k',
    apiSecret: 's',
  }).testConnection();
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.environment, 'production');
});

test('rejects unsupported Binance environment before making provider calls', () => {
  assert.throws(
    () => new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }, 'sandbox' as never),
    /Unsupported Binance environment/
  );
});

test('entry market order sends no timeInForce or other undefined parameters', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params: any) {
    received = params as Record<string, unknown>;
    return {
      orderId: 123,
      clientOrderId: 'tce-test-entry',
      symbol: 'BTCUSDT',
      status: 'NEW',
      side: 'BUY',
      type: 'MARKET',
      origQty: '0.001',
      positionSide: 'LONG',
    } as any;
  } as any;
  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  }).placeEntry({ symbol: 'btcusdt', side: 'BUY', quantity: 0.001, positionSide: 'LONG' });
  assert.equal(result.ok, true);
  assert.deepEqual(received, {
    symbol: 'BTCUSDT',
    side: 'BUY',
    positionSide: 'LONG',
    type: 'MARKET',
    quantity: 0.001,
  });
});

test('normalizes Binance object errors instead of returning [object Object]', async () => {
  USDMClient.prototype.submitNewOrder = async function () {
    throw { code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' };
  };
  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  }).placeEntry({ symbol: 'BTCUSDT', side: 'BUY', quantity: 0.001 });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'PROVIDER_ERROR');
    assert.equal(result.error.message, 'Invalid API-key, IP, or permissions for action.');
    assert.equal(result.error.provider, 'binance');
    assert.deepEqual(result.error.details, { providerCode: -2015 });
  }
});

test('entry order maps limit and stop trigger fields', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params: any) {
    received = params as Record<string, unknown>;
    return {
      orderId: 1,
      symbol: 'BTCUSDT',
      status: 'NEW',
      side: 'SELL',
      type: 'STOP',
      origQty: '0.01',
      price: '100000',
      stopPrice: '101000',
    } as any;
  } as any;
  await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeEntry({
    symbol: 'BTCUSDT',
    side: 'SELL',
    quantity: 0.01,
    price: 100000,
    triggerPrice: 101000,
    timeInForce: 'GTC',
  });
  assert.equal(received?.type, 'STOP');
  assert.equal(received?.price, 100000);
  assert.equal(received?.stopPrice, 101000);
  assert.equal(received?.timeInForce, 'GTC');
});

test('take profit omits reduceOnly in hedge mode', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params: any) {
    received = params as Record<string, unknown>;
    return {
      orderId: 456,
      symbol: 'ETHUSDT',
      status: 'NEW',
      side: 'SELL',
      type: 'TAKE_PROFIT_MARKET',
      stopPrice: '4000',
      positionSide: 'LONG',
    } as any;
  } as any;
  await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeTakeProfit({
    symbol: 'ETHUSDT',
    side: 'SELL',
    positionSide: 'LONG',
    quantity: 0.1,
    triggerPrice: 4000,
  });
  assert.equal(received?.type, 'TAKE_PROFIT_MARKET');
  assert.equal(received?.stopPrice, 4000);
  assert.equal(received?.reduceOnly, undefined);
  assert.equal(received?.timeInForce, undefined);
  assert.equal(received?.quantity, undefined);
});

test('stop loss omits reduceOnly in hedge mode', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params: any) {
    received = params as Record<string, unknown>;
    return {
      orderId: 789,
      symbol: 'ETHUSDT',
      status: 'NEW',
      side: 'SELL',
      type: 'STOP_MARKET',
      stopPrice: '3500',
      positionSide: 'LONG',
    } as any;
  } as any;
  await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeStopLoss({
    symbol: 'ETHUSDT',
    side: 'SELL',
    positionSide: 'LONG',
    quantity: 0.1,
    triggerPrice: 3500,
  });
  assert.equal(received?.type, 'STOP_MARKET');
  assert.equal(received?.stopPrice, 3500);
  assert.equal(received?.reduceOnly, undefined);
  assert.equal(received?.timeInForce, undefined);
  assert.equal(received?.quantity, undefined);
});

test('rejects invalid order input before making provider calls', async () => {
  let called = false;
  USDMClient.prototype.submitNewOrder = async function () {
    called = true;
    return {} as any;
  };
  const result = await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeEntry({
    symbol: 'BTCUSDT',
    side: 'BUY',
    quantity: 0,
    positionSide: 'BOTH',
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'INVALID_INPUT');
    assert.equal(result.error.message, 'Binance quantity must be greater than 0');
  }
  assert.equal(called, false);
});

test('cancelOrder requires order id or client order id', async () => {
  let called = false;
  USDMClient.prototype.cancelOrder = async function () {
    called = true;
    return { orderId: 1, symbol: 'BTCUSDT', status: 'CANCELED' } as any;
  } as any;
  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'k',
    apiSecret: 's',
  }).cancelOrder({ symbol: 'BTCUSDT' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_INPUT');
  assert.equal(called, false);
});

test('cancelOrder maps Binance cancel response', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.cancelOrder = async function (params: any) {
    received = params as Record<string, unknown>;
    return {
      orderId: 123,
      clientOrderId: 'tce-order',
      symbol: 'BTCUSDT',
      status: 'CANCELED',
    } as any;
  } as any;
  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'k',
    apiSecret: 's',
  }).cancelOrder({ symbol: 'btcusdt', orderId: '123' });
  assert.equal(result.ok, true);
  assert.deepEqual(received, { symbol: 'BTCUSDT', orderId: 123 });
  if (result.ok)
    assert.deepEqual(result.data, {
      orderId: '123',
      clientOrderId: 'tce-order',
      symbol: 'BTCUSDT',
      status: 'CANCELED',
      source: 'binance',
    });
});
