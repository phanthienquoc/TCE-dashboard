import assert from 'node:assert/strict';
import test from 'node:test';
import { BINANCE_FUTURES_URLS, getBinanceFuturesUrl } from './binance.constants.js';

test('binds production Binance Futures URL without API discovery', () => {
  assert.equal(getBinanceFuturesUrl('production'), 'https://fapi.binance.com');
});

test('binds testnet Binance Futures URL without API discovery', () => {
  assert.equal(getBinanceFuturesUrl('testnet'), 'https://testnet.binancefuture.com');
});

test('rejects unsupported Binance environment', () => {
  assert.throws(() => getBinanceFuturesUrl('sandbox'), /Unsupported Binance environment/);
});

test('environment constants are immutable', () => {
  assert.deepEqual(Object.keys(BINANCE_FUTURES_URLS).sort(), ['production', 'testnet']);
});
