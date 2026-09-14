import { ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { MongoDbClient } from '../db/mongodb.client';

type MongoEvent = {
  _id?: ObjectId;
  symbol?: string;
  'Mã CK'?: string;
  'Sàn'?: string;
  'Ngày GDKHQ'?: string | null;
  'Ngày ĐKCC'?: string | null;
  'Ngày thực hiện'?: string | null;
  'Nội dung sự kiện'?: string | null;
  'Tỷ lệ'?: string | null;
  gdkhq_timestamp?: Date | string | null;
  dividendValue?: number | string | null;
  price?: number | string | null;
  crawled_at?: Date | string | null;
  synced_at?: Date | string | null;
};

const BATCH_SIZE = 500;

function asIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapEvent(row: MongoEvent) {
  const mongoId = row._id ? String(row._id) : null;
  if (!mongoId) return null;

  return {
    mongo_id: mongoId,
    symbol: row['Mã CK']?.trim() || row.symbol?.trim() || null,
    exchange: row['Sàn']?.trim() || null,
    ex_right_date: asDateOnly(row['Ngày GDKHQ']),
    record_date: asDateOnly(row['Ngày ĐKCC']),
    payment_date: asDateOnly(row['Ngày thực hiện']),
    event_content: row['Nội dung sự kiện']?.trim() || null,
    ratio_text: row['Tỷ lệ']?.trim() || null,
    dividend_value: asNumber(row.dividendValue),
    reference_price: asNumber(row.price),
    gdkhq_timestamp: asIsoDate(row.gdkhq_timestamp),
    crawled_at: asIsoDate(row.crawled_at),
    synced_at: asIsoDate(row.synced_at),
    raw_data: row,
  };
}

export async function migrateMongoEvents(options?: { limit?: number }) {
  const mongo = new MongoDbClient();
  await mongo.onModuleInit?.();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const db = await mongo.getDb();
  const collectionName = process.env.MONGO_EVENTS_COLLECTION?.trim() || 'events';
  const cursor = db
    .collection<MongoEvent>(collectionName)
    .find({})
    .sort({ _id: 1 })
    .batchSize(BATCH_SIZE);

  let buffer: ReturnType<typeof mapEvent>[] = [];
  let processed = 0;
  const limit = options?.limit ?? Infinity;

  for await (const row of cursor) {
    if (processed >= limit) break;
    const mapped = mapEvent(row);
    if (!mapped) continue;
    buffer.push(mapped);
    processed += 1;

    if (buffer.length >= BATCH_SIZE) {
      await flush(supabase, buffer);
      buffer = [];
    }
  }

  if (buffer.length > 0) await flush(supabase, buffer);
  await mongo.onModuleDestroy?.();

  return { processed };
}

async function flush(supabase: ReturnType<typeof createClient>, rows: NonNullable<ReturnType<typeof mapEvent>>[]) {
  const { error } = await supabase.from('stock_events').upsert(rows, {
    onConflict: 'mongo_id',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(`stock_events upsert failed: ${error.message}`);
}
