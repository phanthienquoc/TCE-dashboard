import type { TceDividendEvent } from '@tce/contracts';

type StockDividendEventRow = {
  _id?: unknown;
  symbol?: string;
  'Mã CK'?: string;
  'Ngày GDKHQ'?: string | null;
  'Ngày thực hiện'?: string | null;
  'Tỷ lệ'?: string | null;
  dividendValue?: number | string | null;
};

/** Maps the stock-events provider shape into the provider-neutral TCE dividend contract. */
export function normalizeTceDividendEvent(
  row: StockDividendEventRow,
  source = 'stock-events'
): TceDividendEvent | null {
  const symbol = String(row['Mã CK'] ?? row.symbol ?? '')
    .trim()
    .toUpperCase();
  const exDividendAt = normalizeDate(row['Ngày GDKHQ']);
  if (!symbol || !exDividendAt) return null;

  const paymentAt = normalizeDate(row['Ngày thực hiện']);
  const dividendValue = normalizeNumber(row.dividendValue);
  const id = stableEventId(row._id, symbol, exDividendAt, row['Tỷ lệ']);

  return {
    id,
    symbol,
    dividendType: 'CASH',
    ...(dividendValue !== undefined ? { dividendValue } : {}),
    ...(dividendValue !== undefined ? { dividendYield: undefined } : {}),
    exDividendAt,
    ...(paymentAt ? { paymentAt } : {}),
    eligibility: [],
    source,
  };
}

function stableEventId(
  rawId: unknown,
  symbol: string,
  exDividendAt: string,
  rate?: string | null
): string {
  const providerId = String(rawId ?? '').trim();
  if (providerId) return `${providerId}`;
  return `dividend:${symbol}:${exDividendAt}:${String(rate ?? '').trim()}`;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
