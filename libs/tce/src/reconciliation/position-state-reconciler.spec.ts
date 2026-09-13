import { describe, expect, it } from 'vitest';
import { reconcilePositionStates } from './position-state-reconciler';

describe('reconcilePositionStates', () => {
  it('converges when local and provider positions match', () => {
    expect(
      reconcilePositionStates(
        [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
        [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }]
      )
    ).toEqual([
      expect.objectContaining({ symbol: 'DPM', disposition: 'CONVERGED' }),
    ]);
  });

  it('uses provider quantity and average cost as authoritative updates', () => {
    const [delta] = reconcilePositionStates(
      [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
      [{ symbol: 'DPM', quantity: 120, avgCost: 29900 }]
    );
    expect(delta).toMatchObject({
      symbol: 'DPM',
      disposition: 'UPDATED',
      providerQuantity: 120,
      providerAvgCost: 29900,
    });
  });

  it('fails closed for a missing provider holding', () => {
    const [delta] = reconcilePositionStates(
      [{ id: '1', symbol: 'DPM', quantity: 100, avgCost: 30000, status: 'OPEN' }],
      []
    );
    expect(delta.disposition).toBe('MISSING_PROVIDER_POSITION');
  });

  it('reports unexpected provider holdings without auto-adopting them', () => {
    const [delta] = reconcilePositionStates(
      [],
      [{ symbol: 'DPM', quantity: 100, avgCost: 30000 }]
    );
    expect(delta.disposition).toBe('UNEXPECTED_PROVIDER_POSITION');
  });

  it('fails closed for invalid or duplicate provider truth', () => {
    const deltas = reconcilePositionStates(
      [],
      [
        { symbol: 'DPM', quantity: 100, avgCost: 30000 },
        { symbol: 'DPM', quantity: 50, avgCost: 30000 },
      ]
    );
    expect(deltas[1].disposition).toBe('RECONCILIATION_REQUIRED');
  });
});
