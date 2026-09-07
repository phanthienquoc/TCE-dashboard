import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { MongoDbClient } from '../db/mongodb.client';

const DEFAULT_LIMIT = 100;
const DEFAULT_COLLECTION = 'events';

type StockEventRow = {
  _id?: ObjectId | string;
  symbol?: string;
  'Mã CK'?: string;
  'Ngày GDKHQ'?: string | null;
  'Ngày ĐKCC'?: string | null;
  'Ngày thực hiện'?: string | null;
  'Nội dung sự kiện'?: string | null;
  'Tỷ lệ'?: string | null;
  gdkhq_timestamp?: string | Date | null;
  dividendValue?: number | string | null;
  price?: number | string | null;
  crawled_at?: string | Date | null;
};

@Injectable()
export class StockEventsService {
  constructor(private readonly mongo: MongoDbClient) {}

  async getUpcoming(limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 200);
    const collectionName = process.env.MONGO_EVENTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    try {
      const db = await this.mongo.getDb();
      const rows = await db
        .collection<StockEventRow>(collectionName)
        .find({ gdkhq_timestamp: { $gte: today } })
        .sort({ gdkhq_timestamp: 1 })
        .limit(safeLimit)
        .toArray();

      return rows
        .map(row => ({
          id: String(row._id ?? ''),
          ticker: row['Mã CK'] ?? row.symbol ?? '',
          exDividendDate: row['Ngày GDKHQ'] ?? normalizeDate(row.gdkhq_timestamp) ?? '',
          exDividendTimestamp: normalizeDate(row.gdkhq_timestamp),
          eventContent: row['Nội dung sự kiện'] ?? '',
          dividendRate: row['Tỷ lệ'] ?? '',
          dividendValue: Number(row.dividendValue ?? 0),
          crawledAt: normalizeDate(row.crawled_at),
        }))
        .filter(row => row.ticker && row.exDividendDate);
    } catch (error) {
      throw new ServiceUnavailableException(
        `Stock events MongoDB query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
