import { parseTradingSignal } from './trading-signal.parser';

describe('parseTradingSignal', () => {
  it('parses the canonical signal', () => {
    expect(parseTradingSignal(`XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567`)).toEqual({
      symbol: 'XAUUSD', side: 'BUY', entry: 4582, takeProfit: 4588, stopLoss: 4567,
    });
  });

  it('accepts the canonical signal on one line', () => {
    expect(parseTradingSignal('XAUUSD BUY ENTRY 4582 TP 4588 SL 4567').takeProfit).toBe(4588);
  });

  it('rejects entry ranges and multiple TP values', () => {
    expect(() => parseTradingSignal('XAUUSD BUY ENTRY 4580-4582 TP 4588 SL 4567')).toThrow();
    expect(() => parseTradingSignal('XAUUSD BUY ENTRY 4582 TP 4588 4592 SL 4567')).toThrow();
  });

  it('rejects invalid BUY direction', () => {
    expect(() => parseTradingSignal('XAUUSD BUY ENTRY 4582 TP 4567 SL 4588')).toThrow('BUY signal requires SL < ENTRY < TP');
  });

  it('rejects invalid SELL direction', () => {
    expect(() => parseTradingSignal('XAUUSD SELL ENTRY 4582 TP 4588 SL 4567')).toThrow('SELL signal requires TP < ENTRY < SL');
  });
});
