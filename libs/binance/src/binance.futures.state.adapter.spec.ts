import { USDMClient } from 'binance';
import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { BinanceFuturesStateAdapter } from './binance.futures.state.adapter';

const originalPositionRisk = USDMClient.prototype.getPositionRisk;
const originalOpenOrders = USDMClient.prototype.getAllOpenOrders;
const originalOrder = USDMClient.prototype.getOrder;

afterEach(() => {
  USDMClient.prototype.getPositionRisk = originalPositionRisk;
  USDMClient.prototype.getAllOpenOrders = originalOpenOrders;
  USDMClient.prototype.getOrder = originalOrder;
});

test('positions normalizes Binance futures position state', async () => {
  USDMClient.prototype.getPositionRisk = async function () {
    return [{ symbol: 'BTCUSDT', positionAmt: '0.01', entryPrice: '100000', markPrice: '101000', unRealizedProfit: '10', positionSide: 'BOTH' }];
  };
  const result = await new BinanceFuturesStateAdapter({ apiKey: 'k', apiSecret: 's' }).positions('BTCUSDT');
  assert.deepEqual(result[0], { symbol: 'BTCUSDT', positionAmt: 0.01, entryPrice: 100000, markPrice: 101000, unrealizedProfit: 10, positionSide: 'BOTH' });
});

test('openOrders exposes protection fields used by reconciliation', async () => {
  USDMClient.prototype.getAllOpenOrders = async function () {
    return [{ orderId: 1, clientOrderId: 'TCE-SL-test', symbol: 'BTCUSDT', status: 'NEW', side: 'SELL', type: 'STOP_MARKET', origQty: '0.01', stopPrice: '99000', positionSide: 'BOTH', reduceOnly: true }];
  };
  const result = await new BinanceFuturesStateAdapter({ apiKey: 'k', apiSecret: 's' }).openOrders('BTCUSDT');
  assert.equal(result[0].type, 'STOP_MARKET');
  assert.equal(result[0].stopPrice, 99000);
  assert.equal(result[0].reduceOnly, true);
});

test('state adapter rejects missing credentials before provider calls', async () => {
  let called = false;
  USDMClient.prototype.getPositionRisk = async function () { called = true; return []; };
  await assert.rejects(() => new BinanceFuturesStateAdapter({}).positions('BTCUSDT'), /credentials are not configured/);
  assert.equal(called, false);
});
