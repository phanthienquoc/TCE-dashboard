import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { MongoDbClient } from '../db/mongodb.client';
import { StockEventsSupabaseRepository, StockEvent } from './stock-events.supabase.repository';

const DEFAULT_LIMIT = 100;
const DEFAULT_COLLECTION = 'events';
type ReadSource = 'mongo' | 'supabase' | 'shadow';

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
  private readonly logger = new Logger(StockEventsService.name);

  constructor(
    private readonly mongo: MongoDbClient,
    private readonly supabaseEvents: StockEventsSupabaseRepository,
  ) {}

  async getUpcoming(limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 200);
    const source = readSource();

    try {
      if (source === 'supabase') return this.supabaseEvents.getUpcoming(safeLimit);
      const mongoRows = await this.getUpcomingFromMongo(safeLimit);
      if (source === 'shadow') {
        const supabaseRows = await this.supabaseEvents.getUpcoming(safeLimit);
        const mismatches = compareEvents(mongoRows, supabaseRows);
        if (mismatches.length) {
          this.logger.warn(`Stock events shadow mismatch count=${mismatches.length}; sample=${mismatches.slice(0, 5).join(',')}`);
        }
      }
      return mongoRows;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        `Stock events query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getUpcomingFromMongo(limit: number): Promise<StockEvent[]> {
    const collectionName = process.env.MONGO_EVENTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const db = await this.mongo.getDb();
    const rows = await db.collection<StockEventRow>(collectionName)
      .find({ gdkhq_timestamp: { $gte: today } })
      .sort({ gdkhq_timestamp: 1 })
      .limit(limit)
      .toArray();

    return rows.map(row => ({
      id: String(row._id ?? ''),
      ticker: row['Mã CK'] ?? row.symbol ?? '',
      exDividendDate: row['Ngày GDKHQ'] ?? normalizeDate(row.gdkhq_timestamp) ?? '',
      exDividendTimestamp: normalizeDate(row.gdkhq_timestamp),
      executionDate: row['Ngày thực hiện'] ?? null,
      eventContent: row['Nội dung sự kiện'] ?? '',
      dividendRate: row['Tỷ lệ'] ?? '',
      dividendValue: Number(row.dividendValue ?? 0),
      price: row.price == null ? null : Number(row.price),
      crawledAt: normalizeDate(row.crawled_at),
    })).filter(row => row.ticker && row.exDividendDate);
  }
}

function readSource(): ReadSource {
  const value = process.env.STOCK_EVENTS_READ_SOURCE?.trim().toLowerCase();
  if (value === 'supabase' || value === 'shadow') return value;
  return 'mongo';
}

function compareEvents(left: StockEvent[], right: StockEvent[]): string[] {
  const normalize = (event: StockEvent) => JSON.stringify({
    ticker: event.ticker,
    exDividendDate: event.exDividendDate,
    exDividendTimestamp: event.exDividendTimestamp,
    executionDate: event.executionDate,
    eventContent: event.eventContent,
    dividendRate: event.dividendRate,
    dividendValue: event.dividendValue,
    price: event.price,
    crawledAt: event.crawledAt,
  });
  const rightByKey = new Map(right.map(event => [event.id, normalize(event)]));
  const mismatches = left.filter(event => rightByKey.get(event.id) !== normalize(event)).map(event => event.id);
  const leftKeys = new Set(left.map(event => event.id));
  right.forEach(event => { if (!leftKeys.has(event.id)) mismatches.push(event.id); });
  return mismatches;
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
