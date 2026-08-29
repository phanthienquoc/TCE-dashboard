export type TradingSignal = {
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  takeProfit: number;
  stopLoss: number;
};

const SIGNAL_RE =
  /^\s*([A-Z0-9._-]+)\s+(BUY|SELL)\s+ENTRY\s+([0-9]+(?:\.[0-9]+)?)\s+TP\s+([0-9]+(?:\.[0-9]+)?)\s+SL\s+([0-9]+(?:\.[0-9]+)?)\s*$/i;

/** Parse only the canonical TCE signal format. Ambiguous/partial signals are rejected. */
export function parseTradingSignal(input: string): TradingSignal {
  const text = String(input ?? '').trim();
  const match = SIGNAL_RE.exec(text);
  if (!match)
    throw new Error('Invalid signal. Expected: SYMBOL BUY|SELL ENTRY PRICE TP PRICE SL PRICE');

  const [, rawSymbol, rawSide, rawEntry, rawTp, rawSl] = match;
  const symbol = rawSymbol.toUpperCase();
  const side = rawSide.toUpperCase() as TradingSignal['side'];
  const entry = Number(rawEntry);
  const takeProfit = Number(rawTp);
  const stopLoss = Number(rawSl);

  if (
    ![entry, takeProfit, stopLoss].every(Number.isFinite) ||
    entry <= 0 ||
    takeProfit <= 0 ||
    stopLoss <= 0
  ) {
    throw new Error('Entry, TP and SL must be positive numbers');
  }

  if (side === 'BUY' && !(stopLoss < entry && entry < takeProfit)) {
    throw new Error('BUY signal requires SL < ENTRY < TP');
  }
  if (side === 'SELL' && !(takeProfit < entry && entry < stopLoss)) {
    throw new Error('SELL signal requires TP < ENTRY < SL');
  }

  return { symbol, side, entry, takeProfit, stopLoss };
}
