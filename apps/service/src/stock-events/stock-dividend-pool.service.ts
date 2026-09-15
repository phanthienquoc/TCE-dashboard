import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

const DEFAULT_LIMIT = 20;
const DEFAULT_TABLE = 'events';

type StockEventRow = {
  id?: string | number | null;
  _id?: unknown;
  symbol?: string | null;
  'Mã CK'?: string | null;
  'Ngày GDKHQ'?: string | null;
  'Ngày thực hiện'?: string | null;
  'Nội dung sự kiện'?: string | null;
  'Tỷ lệ'?: string | null;
  gdkhq_timestamp?: string | null;
  dividendValue?: number | string | null;
  price?: number | string | null;
};

@Injectable()
export class StockDividendPoolService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getTop(limit = DEFAULT_LIMIT, month?: string) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 20);
    const table = process.env.SUPABASE_EVENTS_TABLE?.trim() || DEFAULT_TABLE;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const selectedMonth =
      month && /^\d{4}-\d{2}$/.test(month)
        ? month
        : `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 1));
    const rangeStart = start > today ? start : today;

    try {
      const { data, error } = await this.supabase.db
        .from(table)
        .select('*')
        .gte('gdkhq_timestamp', rangeStart.toISOString())
        .lt('gdkhq_timestamp', end.toISOString())
        .order('gdkhq_timestamp', { ascending: true })
        .limit(200);

      if (error) throw error;

      return (data as StockEventRow[])
        .map(row => {
          const ticker = String(row['Mã CK'] ?? row.symbol ?? '').trim();
          const dividendValue = Number(row.dividendValue ?? 0);
          const price = Number(row.price ?? 0);
          const yieldPct = price > 0 ? (dividendValue / price) * 100 : 0;
          const exDate = normalizeDate(row.gdkhq_timestamp);
          const days = exDate
            ? Math.max(0, Math.ceil((new Date(exDate).getTime() - today.getTime()) / 86_400_000))
            : 999;
          const dividendScore = Math.min(45, yieldPct * 4.5);
          const valueScore = Math.min(35, dividendValue / 1000);
          const timingScore = Math.max(0, 20 - Math.min(days, 20));
          return {
            id: String(row.id ?? row._id ?? ''),
            ticker,
            exDividendDate: row['Ngày GDKHQ'] ?? exDate ?? '',
            exDividendTimestamp: exDate,
            paymentDate: row['Ngày thực hiện'] ?? null,
            eventContent: row['Nội dung sự kiện'] ?? '',
            dividendRate: row['Tỷ lệ'] ?? '',
            dividendValue,
            price: price || null,
            dividendYieldPct: Number(yieldPct.toFixed(2)),
            score: Number((dividendScore + valueScore + timingScore).toFixed(2)),
            daysToExDate: days,
          };
        })
        .filter(row => row.ticker && row.exDividendDate)
        .sort((a, b) => b.score - a.score || a.daysToExDate - b.daysToExDate)
        .slice(0, safeLimit)
        .map((row, index) => ({ ...row, rank: index + 1 }));
    } catch (error) {
      throw new ServiceUnavailableException(
        `Stock dividend pool query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
