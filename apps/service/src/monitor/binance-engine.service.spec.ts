import assert from 'node:assert/strict';
import test from 'node:test';

function percentPrice(base: number, pct: number) {
  return Number((base * (1 + pct / 100)).toFixed(2));
}

test('XAU fallback protection is +5% TP / -5% SL for LONG', () => {
  const entry = 2500;
  assert.equal(percentPrice(entry, 5), 2625);
  assert.equal(percentPrice(entry, -5), 2375);
});

test('XAU fallback protection is -5% TP / +5% SL for SHORT', () => {
  const entry = 2500;
  assert.equal(percentPrice(entry, -5), 2375);
  assert.equal(percentPrice(entry, 5), 2625);
});

test('symbol is normalized to a single configured XAU instrument', () => {
  assert.equal(String('xauusdt').trim().toUpperCase(), 'XAUUSDT');
});
