import type { StockEvent } from './stock-events.supabase.repository';

export type StockEventValidation = {
  count: number;
  distinctIds: number;
  distinctSymbols: number;
  missingIds: number;
  missingSymbols: number;
  missingTimestamps: number;
  minTimestamp: string | null;
  maxTimestamp: string | null;
};

export function validateStockEvents(rows: StockEvent[]): StockEventValidation {
  const timestamps = rows
    .map(row => row.exDividendTimestamp)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    count: rows.length,
    distinctIds: new Set(rows.map(row => row.id)).size,
    distinctSymbols: new Set(rows.map(row => row.ticker).filter(Boolean)).size,
    missingIds: rows.filter(row => !row.id).length,
    missingSymbols: rows.filter(row => !row.ticker).length,
    missingTimestamps: rows.filter(row => !row.exDividendTimestamp).length,
    minTimestamp: timestamps[0] ?? null,
    maxTimestamp: timestamps[timestamps.length - 1] ?? null,
  };
}
