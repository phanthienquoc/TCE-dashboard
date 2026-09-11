export type TradingSignal = {
  symbol: string;
  side: 'BUY' | 'SELL';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  entryMin?: number;
  entryMax?: number;
  takeProfits?: number[];
  /** Binance Futures-compatible entry order fields. Quantity is supplied by engine risk/config. */
  orderType: 'LIMIT';
  price: number;
  positionSide: 'BOTH';
  timeInForce: 'GTC';
  reduceOnly: false;
  agentNote?: string;
};

const PRICE = '[0-9]+(?:\\.[0-9]+)?';
const CANONICAL_RE = new RegExp(`^\\s*([A-Z0-9._-]+)\\s+(BUY|SELL)\\s+ENTRY\\s+(${PRICE})\\s+TP\\s+(${PRICE})\\s+SL\\s+(${PRICE})\\s*$`, 'i');
const TELEGRAM_HEAD_RE = new RegExp(`^\\s*#?([A-Z0-9._-]+)\\s+(BUY|SELL)\\s+(${PRICE})\\s*[-_]\\s*(${PRICE})\\s*$`, 'i');
const TP_RE = new RegExp(`^\\s*TP(?:\\s*\\d+)?\\s+(${PRICE})\\s*$`, 'i');
const SL_RE = new RegExp(`^\\s*SL(?:\\s*\\d+)?\\s+(${PRICE})\\s*$`, 'i');

function normalizeExecutionSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return normalized === 'XAUUSD' ? 'XAUUSDT' : normalized;
}

function validateProtection(side: 'BUY' | 'SELL', entry: number, takeProfits: number[], stopLoss: number) {
  if (![entry, stopLoss, ...takeProfits].every(Number.isFinite) || entry <= 0 || stopLoss <= 0 || takeProfits.length === 0 || takeProfits.some(value => value <= 0)) throw new Error('Entry, TP and SL must be positive numbers');
  if (side === 'BUY') {
    if (!(stopLoss < entry && takeProfits.every(tp => tp > entry))) throw new Error(takeProfits.length === 1 ? 'BUY signal requires SL < ENTRY < TP' : 'BUY signal requires SL < ENTRY < every TP');
  } else if (!(takeProfits.every(tp => tp < entry) && entry < stopLoss)) throw new Error(takeProfits.length === 1 ? 'SELL signal requires TP < ENTRY < SL' : 'SELL signal requires every TP < ENTRY < SL');
}

function toTradingSignal(symbol: string, side: 'BUY' | 'SELL', entry: number, takeProfit: number, stopLoss: number, extras: Pick<TradingSignal, 'entryMin' | 'entryMax' | 'takeProfits'> = {}): TradingSignal {
  return { symbol: normalizeExecutionSymbol(symbol), side, entry, takeProfit, stopLoss, ...extras, orderType: 'LIMIT', price: entry, positionSide: 'BOTH', timeInForce: 'GTC', reduceOnly: false };
}

export function parseTradingSignal(input: string): TradingSignal {
  const text = String(input ?? '').replace(/[\u2013\u2014]/g, '-').replace(/\*\*/g, '').replace(/__/g, '').replace(/`/g, '').trim();
  const canonical = CANONICAL_RE.exec(text);
  if (canonical) {
    const [, rawSymbol, rawSide, rawEntry, rawTp, rawSl] = canonical;
    const side = rawSide.toUpperCase() as TradingSignal['side'];
    const entry = Number(rawEntry);
    const takeProfit = Number(rawTp);
    const stopLoss = Number(rawSl);
    validateProtection(side, entry, [takeProfit], stopLoss);
    return toTradingSignal(rawSymbol, side, entry, takeProfit, stopLoss);
  }
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const head = lines.length ? TELEGRAM_HEAD_RE.exec(lines[0]) : null;
  if (!head) throw new Error('Invalid signal. Expected canonical TCE format or #SYMBOL BUY|SELL ENTRY_LOW_ENTRY_HIGH with TP/SL lines.');
  const symbol = normalizeExecutionSymbol(head[1]);
  const side = head[2].toUpperCase() as TradingSignal['side'];
  const entryA = Number(head[3]); const entryB = Number(head[4]);
  const entryMin = Math.min(entryA, entryB); const entryMax = Math.max(entryA, entryB);
  const takeProfits: number[] = []; let stopLoss: number | undefined;
  for (const line of lines.slice(1)) {
    const tp = TP_RE.exec(line);
    if (tp) { takeProfits.push(Number(tp[1])); continue; }
    const sl = SL_RE.exec(line);
    if (sl) { if (stopLoss != null) throw new Error('Only one SL value is allowed'); stopLoss = Number(sl[1]); continue; }
    throw new Error(`Unsupported signal line: ${line}`);
  }
  if (takeProfits.length === 0 || stopLoss == null) throw new Error('Telegram signal requires at least one TP line and exactly one SL line.');
  if (new Set(takeProfits).size !== takeProfits.length) throw new Error('Duplicate TP values are not allowed');
  const entry = side === 'SELL' ? entryMax + 5 : entryMin + 5;
  const takeProfit = takeProfits.length >= 2 ? takeProfits[1] : takeProfits[0];
  validateProtection(side, entry, takeProfits, stopLoss);
  if (side === 'SELL') {
    if (!(stopLoss > entry && takeProfits.every(tp => tp < entryMin))) throw new Error('SELL entry zone requires every TP < entry zone < SL after +5 entry offset');
  } else if (!(stopLoss < entryMin && takeProfits.every(tp => tp > entry))) throw new Error('BUY entry zone requires SL < entry zone and every TP > entry after +5 entry offset');
  return toTradingSignal(symbol, side, entry, takeProfit, stopLoss, { entryMin, entryMax, takeProfits });
}
