import { parseTradingSignal } from './trading-signal.parser';

describe('parseTradingSignal', () => {
  it('parses the canonical signal', () => {
    expect(parseTradingSignal(`XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567`)).toEqual({
      symbol: 'XAUUSD',
      side: 'BUY',
      entry: 4582,
      takeProfit: 4588,
      stopLoss: 4567,
    });
  });

  it('accepts the canonical signal on one line', () => {
    expect(parseTradingSignal('XAUUSD BUY ENTRY 4582 TP 4588 SL 4567').takeProfit).toBe(4588);
  });

  it('parses the Telegram XAU multi-TP entry-zone template', () => {
    const signal = parseTradingSignal(`#XAUUSD SELL 4485_4488

TP 4482
TP 4478
TP 4472
TP 4468
TP 4460
TP 4456

SL 4499`);
    expect(signal).toEqual({
      symbol: 'XAUUSD',
      side: 'SELL',
      entry: 4488,
      takeProfit: 4482,
      stopLoss: 4499,
      entryMin: 4485,
      entryMax: 4488,
      takeProfits: [4482, 4478, 4472, 4468, 4460, 4456],
    });
  });

  it('supports dash as an entry-zone separator', () => {
    const signal = parseTradingSignal('XAUUSD BUY 4485-4488\nTP 4492\nTP 4500\nSL 4478');
    expect(signal.entry).toBe(4485);
    expect(signal.takeProfits).toEqual([4492, 4500]);
  });

  it('rejects invalid entry-zone protection', () => {
    expect(() => parseTradingSignal('XAUUSD SELL 4485_4488\nTP 4490\nSL 4499')).toThrow();
    expect(() => parseTradingSignal('XAUUSD SELL 4485_4488\nTP 4482\nSL 4487')).toThrow();
  });

  it('rejects duplicate TP values', () => {
    expect(() => parseTradingSignal('XAUUSD SELL 4485_4488\nTP 4482\nTP 4482\nSL 4499')).toThrow(
      'Duplicate TP values are not allowed'
    );
  });

  it('rejects invalid BUY direction', () => {
    expect(() => parseTradingSignal('XAUUSD BUY ENTRY 4582 TP 4567 SL 4588')).toThrow(
      'BUY signal requires SL < ENTRY < TP'
    );
  });

  it('rejects invalid SELL direction', () => {
    expect(() => parseTradingSignal('XAUUSD SELL ENTRY 4582 TP 4588 SL 4567')).toThrow(
      'SELL signal requires TP < ENTRY < SL'
    );
  });
});
