import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TceEngine, DEFAULT_TCE_ENGINE_CONFIG } from './index';

test('sells every position at or above profit target', () => {
  const engine = new TceEngine();
  const decisions = engine.evaluate({
    accountId: 'a', totalAssetsValue: 100_000_000, availableBudget: 0,
    positions: [
      { symbol: 'AAA', quantity: 100, averagePrice: 10, marketPrice: 11, marketValue: 1_100, unrealizedPnl: 100, costBasis: 1_000, unrealizedPnlPct: 10 },
      { symbol: 'BBB', quantity: 100, averagePrice: 10, marketPrice: 10.5, marketValue: 1_050, unrealizedPnl: 50, costBasis: 1_000, unrealizedPnlPct: 5 },
    ], candidates: [],
  }, { ...DEFAULT_TCE_ENGINE_CONFIG, enabled: true });
  assert.deepEqual(decisions, [{ action: 'SELL', symbol: 'AAA', quantity: 100, reason: 'profit_target_reached', profitPct: 10 }]);
});

test('sizes the buy to remaining budget, 40 percent cap, and lots of 100', () => {
  const engine = new TceEngine();
  const decisions = engine.evaluate({
    accountId: 'a', totalAssetsValue: 100_000_000, availableBudget: 50_000_000,
    positions: [], candidates: [{ symbol: 'AAA', rank: 1, price: 31_000 }],
  }, { ...DEFAULT_TCE_ENGINE_CONFIG, enabled: true });
  assert.deepEqual(decisions, [{ action: 'BUY', symbol: 'AAA', quantity: 1200, estimatedValue: 37_200_000, reason: 'reinvest_remaining_budget_with_risk_cap' }]);
});

test('does not add a sixth asset', () => {
  const engine = new TceEngine();
  const positions = ['A','B','C','D','E'].map((symbol) => ({ symbol, quantity: 100, averagePrice: 10, marketPrice: 10, marketValue: 1_000 }));
  const decisions = engine.evaluate({ accountId: 'a', totalAssetsValue: 100_000, availableBudget: 50_000, positions, candidates: [{ symbol: 'F', price: 10, rank: 1 }] }, { ...DEFAULT_TCE_ENGINE_CONFIG, enabled: true });
  assert.deepEqual(decisions, [{ action: 'HOLD', reason: 'max_assets_reached' }]);
});
