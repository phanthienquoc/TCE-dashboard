import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { MongoDbClient } from '../db/mongodb.client';

const DEFAULT_LIMIT = 100;
const DEFAULT_COLLECTION = 'events';

type StockEventRow = {
  _id?: ObjectId | string;
  id?: string;
  ticker?: string;
  ex_dividend_date?: string | Date;
  gdkhq_timestamp?: string | Date | null;
  event_content?: string;
  dividend_rate?: string;
  dividend_value?: number | string;
  crawled_at?: string | Date | null;
};

@Injectable()
export class StockEventsService {
  constructor(private readonly mongo: MongoDbClient) {}

  async getUpcoming(limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 200);
    const collectionName = process.env.MONGO_EVENTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
    const today = new Date().toISOString().slice(0, 10);

    try {
      const db = await this.mongo.getDb();
      const rows = await db
        .collection<StockEventRow>(collectionName)
        .find({
          $or: [
            { ex_dividend_date: { $gte: today } },
            { ex_dividend_date: { $gte: new Date(`${today}T00:00:00.000Z`) } },
          ],
        })
        .sort({ ex_dividend_date: 1 })
        .limit(safeLimit)
        .toArray();

      return rows
        .map(row => ({
          id: String(
            row.id ??
              row._id ??
              `${row.ticker ?? ''}|${row.ex_dividend_date ?? ''}|${row.event_content ?? ''}`
          ),
          ticker: row.ticker ?? '',
          exDividendDate: normalizeDate(row.ex_dividend_date),
          exDividendTimestamp: normalizeDate(row.gdkhq_timestamp),
          eventContent: row.event_content ?? '',
          dividendRate: row.dividend_rate ?? '',
          dividendValue: Number(row.dividend_value ?? 0),
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
