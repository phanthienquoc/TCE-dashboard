import { describe, expect, it } from 'vitest';
import { HuntingDividendDecisionEngine } from './hunting-dividend.engine';
import type { DecisionEngineContext } from '@tce/contracts';

const base: DecisionEngineContext = {
  timestamp: '2026-09-09T10:00:00.000Z',
  capital: {
    totalCapital: 300000,
    availableCash: 300000,
    pendingCash: 0,
    stockSellableValue: 0,
    stockPendingT2Value: 0,
  },
  pools: [
    {
      pool: 'A',
      allocatedCapital: 100000,
      availableCapital: 100000,
      pendingT2Capital: 0,
      occupiedSlots: 0,
      totalSlots: 2,
    },
    {
      pool: 'B',
      allocatedCapital: 100000,
      availableCapital: 100000,
      pendingT2Capital: 0,
      occupiedSlots: 0,
      totalSlots: 2,
    },
    {
      pool: 'C',
      allocatedCapital: 100000,
      availableCapital: 100000,
      pendingT2Capital: 0,
      occupiedSlots: 0,
      totalSlots: 2,
    },
  ],
  positions: [],
  candidates: [],
};

const candidate = (overrides = {}) => ({
  symbol: 'DPM',
  price: 30000,
  dividendValue: 1500,
  dividendRatio: '5%',
  gdkhqTimestamp: '2026-09-05T00:00:00.000Z',
  id: 'cand-1',
  ...overrides,
});

describe('HuntingDividendDecisionEngine', () => {
  it('produces deterministic BUY with DB-overridable TP and strategy version', () => {
    const context = { ...base, candidates: [candidate()], config: { tpPercent: 5 } };
    const decisions = new HuntingDividendDecisionEngine().decide(context);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      decision: 'BUY',
      symbol: 'DPM',
      pool: 'A',
      slot: 'A1',
      entry: 30000,
      target: 31500,
      strategyVersion: 'hunting_dividend.v3',
      candidateId: 'cand-1',
    });
    expect(decisions[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('lets DB config override code fallback values', () => {
    const context = {
      ...base,
      candidates: [candidate()],
      config: { tpPercent: 10, strategyVersion: 'db.v1' },
    };
    expect(new HuntingDividendDecisionEngine().decide(context)[0]).toMatchObject({
      target: 33000,
      strategyVersion: 'db.v1',
    });
  });

  it('rejects candidates below confidence threshold without creating BUY', () => {
    expect(
      new HuntingDividendDecisionEngine().decide({
        ...base,
        candidates: [candidate({ dividendValue: 0, dividendRatio: 0, realPnl: 0 })],
      })
    ).toEqual([]);
  });

  it('filters stale and future dividend events', () => {
    expect(
      new HuntingDividendDecisionEngine().decide({
        ...base,
        candidates: [
          candidate({ id: 'stale', gdkhqTimestamp: '2026-07-01T00:00:00.000Z' }),
          candidate({ id: 'future', gdkhqTimestamp: '2026-09-10T00:00:00.000Z' }),
        ],
      })
    ).toEqual([]);
  });

  it('suppresses an occupied symbol', () => {
    expect(
      new HuntingDividendDecisionEngine().decide({
        ...base,
        candidates: [candidate()],
        positions: [
          { symbol: 'DPM', pool: 'B', slot: 'A1', quantity: 100, entitlementStatus: 'UNKNOWN' },
        ],
      })
    ).toHaveLength(1);
    expect(
      new HuntingDividendDecisionEngine().decide({
        ...base,
        candidates: [candidate()],
        positions: [
          { symbol: 'DPM', pool: 'B', slot: 'A1', quantity: 100, entitlementStatus: 'UNKNOWN' },
        ],
      })[0].decision
    ).toBe('WAIT');
  });

  it('allocates deterministically across free slots and pools', () => {
    const decisions = new HuntingDividendDecisionEngine({ slotsPerPool: 1 }).decide({
      ...base,
      candidates: [
        candidate({ id: '1', symbol: 'AAA', dividendRatio: 6 }),
        candidate({ id: '2', symbol: 'BBB', dividendRatio: 5 }),
        candidate({ id: '3', symbol: 'CCC', dividendRatio: 4 }),
      ],
    });
    expect(decisions.map(d => `${d.pool}:${d.slot}:${d.symbol}`)).toEqual([
      'A:A1:AAA',
      'B:B1:BBB',
      'C:C1:CCC',
    ]);
  });

  it('holds when dividend entitlement is at risk even if profit is high', () => {
    const decisions = new HuntingDividendDecisionEngine().decide({
      ...base,
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 130,
          dividendNet: 500,
          entitlementStatus: 'AT_RISK',
        },
      ],
    });
    expect(decisions[0]).toMatchObject({ decision: 'HOLD', entitlementStatus: 'AT_RISK' });
  });

  it('sells only after entitlement is protected when profit net exceeds dividend net', () => {
    const decisions = new HuntingDividendDecisionEngine().decide({
      ...base,
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 130,
          dividendNet: 2000,
          entitlementStatus: 'PROTECTED',
        },
      ],
    });
    expect(decisions[0]).toMatchObject({
      decision: 'SELL',
      profitNet: 3000,
      dividendNet: 2000,
      entitlementStatus: 'PROTECTED',
    });
    expect(decisions[0].reasons).toContain('profit_net_exceeds_dividend_net');
  });

  it('holds when profit net does not exceed dividend net', () => {
    const decisions = new HuntingDividendDecisionEngine().decide({
      ...base,
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 110,
          dividendNet: 2000,
          entitlementStatus: 'PROTECTED',
        },
      ],
    });
    expect(decisions[0].decision).toBe('HOLD');
  });

  it('waits when entitlement or net comparison data is unknown', () => {
    const unknownEntitlement = new HuntingDividendDecisionEngine().decide({
      ...base,
      positions: [
        { symbol: 'DPM', pool: 'A', slot: 'A1', quantity: 100, entryPrice: 100, currentPrice: 130 },
      ],
    });
    expect(unknownEntitlement[0].decision).toBe('WAIT');

    const unknownDividend = new HuntingDividendDecisionEngine().decide({
      ...base,
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 130,
          entitlementStatus: 'PROTECTED',
        },
      ],
    });
    expect(unknownDividend[0].decision).toBe('HOLD');
  });

  it('does not apply a hard-coded invalidation CUT rule', () => {
    const decisions = new HuntingDividendDecisionEngine({ invalidationPercent: 2 }).decide({
      ...base,
      positions: [
        {
          symbol: 'DPM',
          pool: 'A',
          slot: 'A1',
          quantity: 100,
          entryPrice: 100,
          currentPrice: 95,
          dividendNet: 1000,
          entitlementStatus: 'PROTECTED',
        },
      ],
    });
    expect(decisions[0].decision).toBe('HOLD');
    expect(decisions[0].decision).not.toBe('SELL');
  });

  it('creates stable snapshots', () => {
    const engine = new HuntingDividendDecisionEngine();
    const decision = engine.decide({ ...base, candidates: [candidate()] })[0];
    expect(engine.snapshot(decision)).toEqual({
      decisionId: decision.decisionId,
      strategyVersion: 'hunting_dividend.v3',
      decision,
    });
  });
});
