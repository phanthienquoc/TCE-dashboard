export type DividendSymbolRow = {
  symbol: string | null;
};

export type DividendSymbolPageFetcher = (
  from: number,
  to: number
) => Promise<readonly DividendSymbolRow[]>;

export const DIVIDEND_SYMBOL_PAGE_SIZE = 1000;

/**
 * Reads every stock_events page, normalizes symbols, and returns a stable
 * distinct universe. The caller must use a stable unique order for paging.
 */
export async function collectDistinctDividendSymbols(
  fetchPage: DividendSymbolPageFetcher,
  pageSize = DIVIDEND_SYMBOL_PAGE_SIZE
): Promise<string[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('pageSize must be a positive integer');
  }

  const symbols = new Set<string>();

  for (let from = 0; ; from += pageSize) {
    const rows = await fetchPage(from, from + pageSize - 1);

    for (const row of rows) {
      const symbol = String(row.symbol ?? '')
        .trim()
        .toUpperCase();
      if (symbol) symbols.add(symbol);
    }

    if (rows.length < pageSize) break;
  }

  return [...symbols].sort();
}
