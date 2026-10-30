export type MarketPrice = {
  symbol: string;
  price: number;
  tradingDate?: string;
};

export type NormalizedMarketPricePayload = {
  prices: Record<string, MarketPrice>;
  acceptedCount: number;
  rejectedCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate untrusted market-price API data before it enters the dashboard store.
 * Prices must be finite positive numbers and symbols must be part of the request.
 * Invalid rows are counted, never copied into the canonical client-side price map.
 */
export function normalizeMarketPricePayload(
  payload: unknown,
  requestedSymbols: readonly string[]
): NormalizedMarketPricePayload {
  if (!Array.isArray(payload)) {
    return { prices: {}, acceptedCount: 0, rejectedCount: 1 };
  }

  const allowedSymbols = new Set(
    requestedSymbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean)
  );
  const prices: Record<string, MarketPrice> = {};
  let acceptedCount = 0;
  let rejectedCount = 0;

  for (const value of payload) {
    if (!isRecord(value)) {
      rejectedCount += 1;
      continue;
    }

    const symbol = typeof value.symbol === 'string' ? value.symbol.trim().toUpperCase() : '';
    const price = value.price;
    const hasInvalidTradingDate =
      value.tradingDate !== undefined && typeof value.tradingDate !== 'string';

    if (
      !symbol ||
      !allowedSymbols.has(symbol) ||
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price <= 0 ||
      hasInvalidTradingDate
    ) {
      rejectedCount += 1;
      continue;
    }

    const tradingDate =
      typeof value.tradingDate === 'string' ? value.tradingDate.trim() : undefined;
    prices[symbol] = {
      symbol,
      price,
      ...(tradingDate ? { tradingDate } : {}),
    };
    acceptedCount += 1;
  }

  return { prices, acceptedCount, rejectedCount };
}
