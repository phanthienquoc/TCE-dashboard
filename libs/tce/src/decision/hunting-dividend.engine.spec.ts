import { describe, expect, it } from 'vitest';
import { HuntingDividendDecisionEngine } from './hunting-dividend.engine';
import type { DecisionEngineContext } from '@tce/contracts';

const base: DecisionEngineContext = {
  timestamp: '2026-09-09T10:00:00.000Z',
  capital: { totalCapital: 300000, availableCash: 300000, pendingCash: 0, stockSellableValue: 0, stockPendingT2Value: 0 },
  pools: [
    { pool: 'A', allocatedCapital: 100000, availableCapital: 100000, pendingT2Capital: 0, occupiedSlots: 0, totalSlots: 2 },
    { pool: 'B', allocatedCapital: 100000, availableCapital: 100000, pendingT2Capital: 0, occupiedSlots: 0, totalSlots: 2 },
    { pool: 'C', allocatedCapital: 100000, availableCapital: 100000, pendingT2Capital: 0, occupiedSlots: 0, totalSlots: 2 },
  ],
  positions: [],
  candidates: [],
};

const candidate = (overrides = {}) => ({ symbol: 'DPM', price: 30000, dividendValue: 1500, dividendRatio: '5%', gdkhqTimestamp: '2026-09-05T00:00:00.000Z', id: 'cand-1', ...overrides });

describe('HuntingDividendDecisionEngine', () => {
  it('produces deterministic BUY with entry, +5% target and strategy version', () => {
    const context = { ...base, candidates: [candidate()] };
    const decisions = new HuntingDividendDecisionEngine().decide(context);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ decision: 'BUY', symbol: 'DPM', pool: 'A', slot: 'A1', entry: 30000, target: 31500, strategyVersion: 'hunting_dividend.v2', candidateId: 'cand-1', decisionWindowKey: expect.any(String), decisionId: expect.any(String) });
    expect(decisions[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('rejects candidates below confidence threshold without creating BUY', () => {
    const context = { ...base, candidates: [candidate({ dividendValue: 0, dividendRatio: 0, realPnl: 0 })] };
    expect(new HuntingDividendDecisionEngine().decide(context)).toEqual([]);
  });

  it('filters stale and future dividend events', () => {
    const context = { ...base, candidates: [candidate({ id: 'stale', gdkhqTimestamp: '2026-07-01T00:00:00.000Z' }), candidate({ id: 'future', gdkhqTimestamp: '2026-09-10T00:00:00.000Z' })] };
    expect(new HuntingDividendDecisionEngine().decide(context)).toEqual([]);
  });

  it('suppresses an occupied symbol and occupied slot', () => {
    const context = { ...base, candidates: [candidate()] , positions: [{ symbol: 'DPM', pool: 'B', slot: 'A1', quantity: 100 }] };
    expect(new HuntingDividendDecisionEngine().decide(context)).toEqual([]);
  });

  it('allocates deterministically across free slots and pools', () => {
    const context = { ...base, candidates: [candidate({ id: '1', symbol: 'AAA', dividendRatio: 6 }), candidate({ id: '2', symbol: 'BBB', dividendRatio: 5 }), candidate({ id: '3', symbol: 'CCC', dividendRatio: 4 })] };
    const decisions = new HuntingDividendDecisionEngine({ slotsPerPool: 1 }).decide(context);
    expect(decisions.map(d => `${d.pool}:${d.slot}:${d.symbol}`)).toEqual(['A:A1:AAA', 'B:B1:BBB', 'C:C1:CCC']);
  });

  it('supports optional invalidation policy', () => {
    const context = { ...base, candidates: [candidate()] };
    const decision = new HuntingDividendDecisionEngine({ invalidationPercent: 2 }).decide(context)[0];
    expect(decision.invalidation).toBe(29400);
  });

  it('creates stable snapshots', () => {
    const engine = new HuntingDividendDecisionEngine();
    const decision = engine.decide({ ...base, candidates: [candidate()] })[0];
    expect(engine.snapshot(decision)).toEqual({ decisionId: decision.decisionId, strategyVersion: 'hunting_dividend.v2', decision });
  });
});
