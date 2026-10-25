import type { SettlementCalendarPort } from './dre.contracts';

/** Default VN equity T+2 policy. Holidays can be supplied by a later calendar adapter. */
export class WeekdaySettlementCalendar implements SettlementCalendarPort {
  addSettlementDays(start: Date, days: number): Date {
    if (!Number.isInteger(days) || days < 0)
      throw new Error('Settlement days must be a non-negative integer');
    const result = new Date(start);
    let remaining = days;
    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const day = result.getUTCDay();
      if (day !== 0 && day !== 6) remaining -= 1;
    }
    return result;
  }
}
