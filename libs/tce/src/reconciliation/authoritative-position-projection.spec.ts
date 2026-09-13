import { describe, expect, it } from 'vitest';
import { projectAuthoritativeHoldings } from './authoritative-position-projection';

describe('projectAuthoritativeHoldings', () => {
  const local = { id: 'slot-1', symbol: 'DPM', quantity: 100, avgCost: 30000, currentPrice: 30000, targetPrice: 31500, sellableAt: '2026-09-20T00:00:00Z', status: 'OPEN' as const, slotId: 'slot-1', pool: 'A' as const };

  it('projects provider truth into a HOLDING position', () => {
    expect(projectAuthoritativeHoldings([local], [{ symbol: 'dpm', quantity: 120, avgCost: 29900, currentPrice: 31000 }])).toEqual({
      authoritative: true,
      holdings: [{ ...local, symbol: 'DPM', quantity: 120, avgCost: 29900, currentPrice: 31000, status: 'HOLDING', costBasis: 3588000, unrealizedPnl: 132000 }],
    });
  });

  it('fails closed for missing or unexpected holdings', () => {
    expect(projectAuthoritativeHoldings([local], [])).toMatchObject({ authoritative: false, holdings: [] });
    expect(projectAuthoritativeHoldings([], [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }])).toMatchObject({ authoritative: false, holdings: [] });
  });

  it('fails closed for duplicate provider or local identity', () => {
    expect(projectAuthoritativeHoldings([local], [
      { symbol: 'DPM', quantity: 100, avgCost: 30000 },
      { symbol: 'dpm', quantity: 100, avgCost: 30000 },
    ])).toMatchObject({ authoritative: false });
    expect(projectAuthoritativeHoldings([local, { ...local, id: 'slot-2' }], [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }])).toMatchObject({ authoritative: false });
  });

  it('does not invent current price or P&L when provider price is absent', () => {
    const result = projectAuthoritativeHoldings([local], [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }]);
    expect(result.authoritative).toBe(true);
    expect(result.holdings[0]).not.toHaveProperty('unrealizedPnl');
    expect(result.holdings[0].costBasis).toBe(3000000);
  });

  it('rejects closed local positions from authoritative HOLDING state', () => {
    expect(projectAuthoritativeHoldings([{ ...local, status: 'CLOSED' }], [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }])).toMatchObject({ authoritative: false });
  });
});
