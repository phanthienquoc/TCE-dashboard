export type BinanceKlineRow = string[];

/**
 * Load public Binance kline history with a caller-owned cancellation signal.
 * The caller controls the request lifecycle; this helper does not retry or mutate state.
 */
export async function fetchBinanceKlineHistory(
  symbol: string,
  interval: string,
  limit: number,
  signal: AbortSignal
): Promise<BinanceKlineRow[]> {
  const query = new URLSearchParams({
    symbol: symbol.trim().toUpperCase(),
    interval,
    limit: String(Math.min(Math.max(limit, 50), 1000)),
  });
  const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  return (await response.json()) as BinanceKlineRow[];
}
