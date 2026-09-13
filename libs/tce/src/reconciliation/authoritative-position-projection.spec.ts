import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAuthoritativeHoldings } from './authoritative-position-projection';

test('projects provider truth into a HOLDING position', () => {
  const local = {
    id: 'slot-1',
    symbol: 'DPM',
    quantity: 100,
    avgCost: 30000,
    currentPrice: 30000,
    targetPrice: 31500,
    sellableAt: '2026-09-20T00:00:00Z',
    status: 'OPEN' as const,
    slotId: 'slot-1',
    pool: 'A' as const,
  };

  assert.deepEqual(
    projectAuthoritativeHoldings([local], [
      { symbol: 'dpm', quantity: 120, avgCost: 29900, currentPrice: 31000 },
    ]),
    {
      authoritative: true,
      holdings: [
        {
          ...local,
          symbol: 'DPM',
          quantity: 120,
          avgCost: 29900,
          currentPrice: 31000,
          status: 'HOLDING',
          costBasis: 3588000,
          unrealizedPnl: 132000,
        },
      ],
    }
  );
});

test('fails closed for missing or unexpected holdings', () => {
  assert.deepEqual(projectAuthoritativeHoldings([
    {
      id: 'slot-1',
      symbol: 'DPM',
      quantity: 100,
      avgCost: 30000,
      currentPrice: 30000,
      targetPrice: 31500,
      sellableAt: '2026-09-20T00:00:00Z',
      status: 'OPEN' as const,
      slotId: 'slot-1',
      pool: 'A' as const,
    },
  ], []), {
    authoritative: false,
    holdings: [],
    reason: 'Missing provider holding: DPM.',
  });
  assert.deepEqual(projectAuthoritativeHoldings([], [
    { symbol: 'DPM', quantity: 100, avgCost: 30000 },
  ]), {
    authoritative: false,
    holdings: [],
    reason: 'Provider holdings are invalid or ambiguous.',
  });
});

test('fails closed for duplicate provider or local identity', () => {
  const local = {
    id: 'slot-1',
    symbol: 'DPM',
    quantity: 100,
    avgCost: 30000,
    currentPrice: 30000,
    targetPrice: 31500,
    sellableAt: '2026-09-20T00:00:00Z',
    status: 'OPEN' as const,
    slotId: 'slot-1',
    pool: 'A' as const,
  };

  assert.equal(
    projectAuthoritativeHoldings([local], [
      { symbol: 'DPM', quantity: 100, avgCost: 30000, currentPrice: 30000 },
      { symbol: 'dpm', quantity: 100, avgCost: 30000, currentPrice: 30000 },
    ]).authoritative,
    false
  );
  assert.equal(
    projectAuthoritativeHoldings(
      [local, { ...local, id: 'slot-2' }],
      [{ symbol: 'DPM', quantity: 100, avgCost: 30000, currentPrice: 30000 }]
    ).authoritative,
    false
  );
});

test('fails closed when provider current price is absent', () => {
  const local = {
    id: 'slot-1',
    symbol: 'DPM',
    quantity: 100,
    avgCost: 30000,
    currentPrice: 30000,
    targetPrice: 31500,
    sellableAt: '2026-09-20T00:00:00Z',
    status: 'OPEN' as const,
    slotId: 'slot-1',
    pool: 'A' as const,
  };
  const result = projectAuthoritativeHoldings([local], [
    { symbol: 'DPM', quantity: 100, avgCost: 30000 },
  ]);

  assert.equal(result.authoritative, false);
  assert.deepEqual(result.holdings, []);
  assert.equal(result.reason, 'Provider holdings are invalid or ambiguous.');
});

test('rejects closed local positions from authoritative HOLDING state', () => {
  const local = {
    id: 'slot-1',
    symbol: 'DPM',
    quantity: 100,
    avgCost: 30000,
    currentPrice: 30000,
    targetPrice: 31500,
    sellableAt: '2026-09-20T00:00:00Z',
    status: 'CLOSED' as const,
    slotId: 'slot-1',
    pool: 'A' as const,
  };

  assert.equal(
    projectAuthoritativeHoldings([local], [
      { symbol: 'DPM', quantity: 100, avgCost: 30000, currentPrice: 30000 },
    ]).authoritative,
    false
  );
});
