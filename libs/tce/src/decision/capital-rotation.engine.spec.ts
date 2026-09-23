import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionEngineContext } from '@tce/contracts';
import {
  CapitalRotationDecisionEngine,
  CAPITAL_ROTATION_STRATEGY_VERSION,
} from './capital-rotation.engine';

const timestamp = '2026-09-18T02:00:00.000Z';

function context(overrides: Partial<DecisionEngineContext> = {}): DecisionEngineContext {
  return {
    timestamp,
    candidates: [],
    capital: {
      totalCapital: 20_000_000,
      availableCash: 20_000_000,
      pendingCash: 0,
      stockSellableValue: 0,
      stockPendingT2Value: 0,
    },
    pools: [
      {
        pool: 'A',
        allocatedCapital: 8_000_000,
        availableCapital: 8_000_000,
        pendingT2Capital: 0,
        occupiedSlots: 0,
        totalSlots: 1,
      },
    ],
    positions: [],
    config: {
      strategyVersion: CAPITAL_ROTATION_STRATEGY_VERSION,
      takeProfitPercent: 5,
      minConfidence: 0.5,
      slotsPerPool: 1,
      lookbackDays: 30,
      maxHoldDays: 30,
    },
    ...overrides,
  };
}

test('CRDE buys the highest-scored eligible candidate for an available slot', () => {
  const engine = new CapitalRotationDecisionEngine();
  const decisions = engine.decide(
    context({
      candidates: [
        {
          id: 'candidate-b',
          symbol: 'VCB',
          price: 100,
          score: 70,
          expectedReturn: 4,
          exRightDate: timestamp,
        },
        {
          id: 'candidate-a',
          symbol: 'DPM',
          price: 100,
          score: 80,
          expectedReturn: 5,
          exRightDate: timestamp,
        },
      ],
    })
  );

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.decision, 'BUY');
  assert.equal(decisions[0]?.symbol, 'DPM');
  assert.equal(decisions[0]?.pool, 'A');
  assert.equal(decisions[0]?.capital, 8_000_000);
});

test('CRDE never opens a second position for an occupied symbol or slot', () => {
  const engine = new CapitalRotationDecisionEngine();
  const decisions = engine.decide(
    context({
      candidates: [
        {
          id: 'candidate-a',
          symbol: 'DPM',
          price: 100,
          score: 90,
          exRightDate: timestamp,
        },
      ],
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 95,
          currentPrice: 100,
        },
      ],
    })
  );

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.decision, 'SELL');
  assert.equal(decisions[0]?.symbol, 'DPM');
});

test('CRDE sells when target is reached and marks capital for recycling', () => {
  const engine = new CapitalRotationDecisionEngine();
  const decisions = engine.decide(
    context({
      positions: [
        {
          symbol: 'HTL',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 105,
          targetPrice: 105,
        },
      ],
    })
  );

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.decision, 'SELL');
  assert.deepEqual(decisions[0]?.reasons, ['target_reached', 'capital_recycling_ready']);
});

test('CRDE fails closed when no usable capital or slot exists', () => {
  const engine = new CapitalRotationDecisionEngine();
  const decisions = engine.decide(
    context({
      pools: [
        {
          pool: 'A',
          allocatedCapital: 0,
          availableCapital: 0,
          pendingT2Capital: 0,
          occupiedSlots: 1,
          totalSlots: 1,
        },
      ],
      candidates: [
        {
          id: 'candidate-a',
          symbol: 'DPM',
          price: 100,
          score: 100,
          expectedReturn: 5,
          exRightDate: timestamp,
        },
      ],
    })
  );

  assert.deepEqual(decisions, []);
});

test('CRDE decision IDs are deterministic for the same snapshot', () => {
  const input = context({
    candidates: [
      {
        id: 'candidate-a',
        symbol: 'DPM',
        price: 100,
        score: 90,
        expectedReturn: 5,
        exRightDate: timestamp,
      },
    ],
  });

  const engine = new CapitalRotationDecisionEngine();
  const first = engine.decide(input);
  const second = engine.decide(input);

  assert.equal(first[0]?.decisionId, second[0]?.decisionId);
  assert.equal(first[0]?.strategyVersion, CAPITAL_ROTATION_STRATEGY_VERSION);
});
