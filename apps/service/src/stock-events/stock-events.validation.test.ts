import { validateStockEvents } from './stock-events.validation';

describe('validateStockEvents', () => {
  it('reports uniqueness and required-field invariants', () => {
    const result = validateStockEvents([
      { id: '1', ticker: 'AAA', exDividendDate: '2026-01-01', exDividendTimestamp: '2026-01-01T00:00:00.000Z', executionDate: null, eventContent: '', dividendRate: '', dividendValue: 100, price: 10, crawledAt: null },
      { id: '2', ticker: 'BBB', exDividendDate: '2026-01-02', exDividendTimestamp: '2026-01-02T00:00:00.000Z', executionDate: null, eventContent: '', dividendRate: '', dividendValue: 200, price: null, crawledAt: null },
    ]);

    expect(result.count).toBe(2);
    expect(result.distinctIds).toBe(2);
    expect(result.distinctSymbols).toBe(2);
    expect(result.missingIds).toBe(0);
    expect(result.missingSymbols).toBe(0);
    expect(result.missingTimestamps).toBe(0);
    expect(result.minTimestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(result.maxTimestamp).toBe('2026-01-02T00:00:00.000Z');
  });
});
