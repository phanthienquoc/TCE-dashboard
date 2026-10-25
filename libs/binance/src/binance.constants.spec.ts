import { strict as assert } from 'node:assert';
import test from 'node:test';
import { BINANCE_FUTURES_URLS, getBinanceFuturesUrl } from './binance.constants';

test('binds production and testnet Binance futures URLs without API calls', () => {
  assert.equal(BINANCE_FUTURES_URLS.production, 'https://fapi.binance.com');
  assert.equal(BINANCE_FUTURES_URLS.testnet, 'https://testnet.binancefuture.com');
  assert.equal(getBinanceFuturesUrl('production'), BINANCE_FUTURES_URLS.production);
  assert.equal(getBinanceFuturesUrl('testnet'), BINANCE_FUTURES_URLS.testnet);
});
