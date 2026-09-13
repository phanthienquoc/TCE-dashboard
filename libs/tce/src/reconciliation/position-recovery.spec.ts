import { describe, expect, it } from 'vitest';
import {
  InMemoryPositionRecoveryPersistence,
  rebuildPositionOwnership,
  recoverPositions,
} from './position-recovery';

describe('position recovery', () => {
  const position = {
    id: 'slot-1',
    symbol: 'DPM',
    quantity: 100,
    avgCost: 30000,
    currentPrice: 31500,
    targetPrice: 31500,
    status: 'OPEN' as const,
    slotId: 'slot-1',
    pool: 'A' as const,
  };

  it('reconstructs the persisted position after restart', async () => {
    const persistence = new InMemoryPositionRecoveryPersistence();
    await persistence.save({ recordedAt: '2026-09-13T00:00:00Z', positions: [position] });
    const recovered = await recoverPositions(persistence);
    expect(recovered).toEqual([position]);
  });

  it('rebuilds deterministic slot/capital ownership from authoritative positions', () => {
    expect(rebuildPositionOwnership([position])).toEqual([
      {
        slotId: 'slot-1',
        pool: 'A',
        ownerKey: 'slot-1',
        quantity: 100,
        capital: 3000000,
      },
    ]);
  });

  it('ignores invalid positions and duplicate ownership keys', () => {
    expect(
      rebuildPositionOwnership([
        position,
        { ...position, symbol: 'VNM' },
        { ...position, id: '', symbol: 'INVALID', quantity: 0 },
      ])
    ).toHaveLength(1);
  });
});
