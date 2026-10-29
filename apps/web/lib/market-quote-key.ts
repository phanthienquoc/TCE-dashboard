/**
 * Canonical cache key for quote entities. Symbols alone can collide when
 * more than one venue is introduced; venue is part of the entity identity.
 */
export function marketQuoteKey(venue: string, symbol: string): string {
  const normalizedVenue = String(venue).trim().toLowerCase();
  const normalizedSymbol = String(symbol).trim().toUpperCase();
  if (!normalizedVenue || !normalizedSymbol) {
    throw new Error('A venue and symbol are required to identify a market quote');
  }
  return `${normalizedVenue}:${normalizedSymbol}`;
}
