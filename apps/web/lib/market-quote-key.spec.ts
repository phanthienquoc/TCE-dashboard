import assert from 'node:assert/strict';
import test from 'node:test';
import { marketQuoteKey } from './market-quote-key';

test('normalizes venue and symbol consistently', () => {
  assert.equal(marketQuoteKey(' SSI ', 'dpm'), 'ssi:DPM');
  assert.equal(marketQuoteKey('ssi', 'DPM'), 'ssi:DPM');
});

test('keeps symbols from different venues isolated', () => {
  assert.notEqual(marketQuoteKey('ssi', 'DPM'), marketQuoteKey('binance', 'DPM'));
});

test('rejects missing identity parts', () => {
  assert.throws(() => marketQuoteKey('', 'DPM'));
  assert.throws(() => marketQuoteKey('ssi', '   '));
});
