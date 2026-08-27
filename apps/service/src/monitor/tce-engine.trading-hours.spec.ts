const { isVietnamWeekdayTradingTime } = require('./tce-engine.trading-hours');

describe('isVietnamWeekdayTradingTime', () => {
  const at = (iso: string) => new Date(iso);

  it('allows weekday morning session', () => {
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T02:00:00.000Z'))).toBe(true); // 09:00 ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T04:29:59.000Z'))).toBe(true); // 11:29 ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T04:30:00.000Z'))).toBe(false); // 11:30 ICT boundary
  });

  it('allows weekday afternoon session', () => {
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T06:00:00.000Z'))).toBe(true); // 13:00 ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T07:59:59.000Z'))).toBe(true); // 14:59 ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T08:00:00.000Z'))).toBe(false); // 15:00 ICT boundary
  });

  it('blocks lunch break and weekend', () => {
    expect(isVietnamWeekdayTradingTime(at('2026-08-27T05:00:00.000Z'))).toBe(false); // 12:00 ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-29T02:00:00.000Z'))).toBe(false); // Saturday ICT
    expect(isVietnamWeekdayTradingTime(at('2026-08-30T02:00:00.000Z'))).toBe(false); // Sunday ICT
  });
});
