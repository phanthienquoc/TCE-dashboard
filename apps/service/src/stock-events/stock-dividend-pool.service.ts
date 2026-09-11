import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';

const DEFAULT_LIMIT = 20;
const DEFAULT_COLLECTION = 'events';

type StockEventRow = {
  _id?: unknown;
  symbol?: string;
  'Mã CK'?: string;
  'Ngày GDKHQ'?: string | null;
  'Ngày thực hiện'?: string | null;
  'Nội dung sự kiện'?: string | null;
  'Tỷ lệ'?: string | null;
  gdkhq_timestamp?: string | Date | null;
  dividendValue?: number | string | null;
  price?: number | string | null;
};

@Injectable()
export class StockDividendPoolService {
  constructor(private readonly mongo: MongoDbClient) {}

  async getTop(limit = DEFAULT_LIMIT, month?: string) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 20);
    const collectionName = process.env.MONGO_EVENTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
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
      const db = await this.mongo.getDb();
      const rows = await db
        .collection<StockEventRow>(collectionName)
        .find({ gdkhq_timestamp: { $gte: rangeStart, $lt: end } })
        .sort({ gdkhq_timestamp: 1 })
        .limit(200)
        .toArray();

      return rows
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
            id: String(row._id ?? ''),
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

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
