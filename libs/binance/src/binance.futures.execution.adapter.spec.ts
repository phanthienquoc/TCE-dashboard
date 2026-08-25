import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { USDMClient } from 'binance';
import { BinanceFuturesExecutionAdapter } from './binance.futures.execution.adapter';

const originalSubmit = USDMClient.prototype.submitNewOrder;
const originalBalance = USDMClient.prototype.getBalance;

afterEach(() => {
  USDMClient.prototype.submitNewOrder = originalSubmit;
  USDMClient.prototype.getBalance = originalBalance;
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
    return [{ asset: 'USDT', balance: '100' }];
  };

  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  }, 'testnet').testConnection();

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.connected, true);
    assert.equal(result.data.environment, 'testnet');
    assert.equal(result.data.balances.length, 1);
  }
});

test('production is the default Binance environment', async () => {
  USDMClient.prototype.getBalance = async function () { return []; };
  const result = await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).testConnection();
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.environment, 'production');
});

test('rejects unsupported Binance environment before making provider calls', () => {
  assert.throws(() => new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }, 'sandbox' as never), /Unsupported Binance environment/);
});

test('entry order maps market payload correctly and never calls a real Binance API', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params) {
    received = params as Record<string, unknown>;
    return {
      orderId: 123,
      clientOrderId: 'tce-test-entry',
      symbol: 'BTCUSDT',
      status: 'NEW',
      side: 'BUY',
      type: 'MARKET',
      origQty: '0.001',
    };
  };

  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  }).placeEntry({
    symbol: 'btcusdt', side: 'BUY', quantity: 0.001, positionSide: 'LONG',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(received, {
    symbol: 'BTCUSDT', side: 'BUY', positionSide: 'LONG', type: 'MARKET', quantity: 0.001,
    price: undefined, stopPrice: undefined, reduceOnly: 'false', newClientOrderId: undefined, timeInForce: undefined,
  });
});

test('normalizes Binance object errors instead of returning [object Object]', async () => {
  USDMClient.prototype.submitNewOrder = async function () {
    throw { code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' };
  };

  const result = await new BinanceFuturesExecutionAdapter({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  }).placeEntry({
    symbol: 'BTCUSDT', side: 'BUY', quantity: 0.001,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'PROVIDER_ERROR');
    assert.equal(result.error.message, 'Invalid API-key, IP, or permissions for action.');
    assert.equal(result.error.provider, 'binance');
    assert.deepEqual(result.error.details, { providerCode: -2015 });
    assert.notEqual(result.error.message, '[object Object]');
  }
});

test('entry order maps limit and stop trigger fields', async () => {
  const calls: Record<string, unknown>[] = [];
  USDMClient.prototype.submitNewOrder = async function (params) {
    calls.push(params as Record<string, unknown>);
    return { orderId: calls.length, symbol: 'BTCUSDT', status: 'NEW', side: 'SELL', type: 'STOP', origQty: '0.01', price: '100000', stopPrice: '101000' };
  };

  const adapter = new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' });
  await adapter.placeEntry({ symbol: 'BTCUSDT', side: 'SELL', quantity: 0.01, price: 100000, triggerPrice: 101000, timeInForce: 'GTC' });

  assert.equal(calls[0].type, 'STOP');
  assert.equal(calls[0].price, 100000);
  assert.equal(calls[0].stopPrice, 101000);
  assert.equal(calls[0].timeInForce, 'GTC');
});

test('take profit defaults to reduceOnly and uses TAKE_PROFIT_MARKET', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params) {
    received = params as Record<string, unknown>;
    return { orderId: 456, symbol: 'ETHUSDT', status: 'NEW', side: 'SELL', type: 'TAKE_PROFIT_MARKET', stopPrice: '4000' };
  };

  await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeTakeProfit({
    symbol: 'ETHUSDT', side: 'SELL', positionSide: 'LONG', quantity: 0.1, triggerPrice: 4000,
  });

  assert.equal(received?.type, 'TAKE_PROFIT_MARKET');
  assert.equal(received?.stopPrice, 4000);
  assert.equal(received?.reduceOnly, 'true');
  assert.equal(received?.quantity, undefined);
});

test('stop loss defaults to reduceOnly and uses STOP_MARKET', async () => {
  let received: Record<string, unknown> | undefined;
  USDMClient.prototype.submitNewOrder = async function (params) {
    received = params as Record<string, unknown>;
    return { orderId: 789, symbol: 'ETHUSDT', status: 'NEW', side: 'SELL', type: 'STOP_MARKET', stopPrice: '3500' };
  };

  await new BinanceFuturesExecutionAdapter({ apiKey: 'k', apiSecret: 's' }).placeStopLoss({
    symbol: 'ETHUSDT', side: 'SELL', positionSide: 'LONG', quantity: 0.1, triggerPrice: 3500,
  });

  assert.equal(received?.type, 'STOP_MARKET');
  assert.equal(received?.stopPrice, 3500);
  assert.equal(received?.reduceOnly, 'true');
  assert.equal(received?.quantity, undefined);
});
