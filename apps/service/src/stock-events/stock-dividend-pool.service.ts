import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';

const DEFAULT_LIMIT = 20;
const DEFAULT_COLLECTION = 'events';
const ENTRY_LOW_FACTOR = 0.97;
const ENTRY_HIGH_FACTOR = 0.995;
const BASE_TP_UPSIDE = 0.02;
const MAX_TP_UPSIDE = 0.1;

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
  tce_entry_low?: number | null;
  tce_entry_high?: number | null;
  tce_target_price?: number | null;
  tce_confidence_score?: number | null;
  tce_agent_note?: string | null;
  tce_agent_updated_at?: string | Date | null;
};

@Injectable()
export class StockDividendPoolService {
  constructor(private readonly mongo: MongoDbClient) {}

  async getTop(limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 20);
    const rows = await this.readUpcoming(safeLimit);
    return rows.map(row => this.toPoolItem(row));
  }

  async recalculateAndPersist(limit = DEFAULT_LIMIT) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 20);
    const rows = await this.readUpcoming(200);
    const selected = rows
      .map(row => this.toPoolItem(row))
      .sort((a, b) => b.score - a.score || a.daysToExDate - b.daysToExDate)
      .slice(0, safeLimit);

    const db = await this.getDb();
    const collectionName = this.getCollectionName();
    const updatedAt = new Date();

    await Promise.all(
      selected.map(item =>
        db.collection<StockEventRow>(collectionName).updateOne(
          { _id: item.id },
          {
            $set: {
              tce_entry_low: item.entryLow,
              tce_entry_high: item.entryHigh,
              tce_target_price: item.targetPrice,
              tce_confidence_score: item.confidenceScore,
              tce_agent_note: item.agentNote,
              tce_agent_updated_at: updatedAt,
            },
          }
        )
      )
    );

    return selected;
  }

  private async readUpcoming(limit: number) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    try {
      const db = await this.getDb();
      return await db
        .collection<StockEventRow>(this.getCollectionName())
        .find({ gdkhq_timestamp: { $gte: today } })
        .sort({ gdkhq_timestamp: 1 })
        .limit(Math.min(Math.max(limit, 1), 200))
        .toArray();
    } catch (error) {
      throw new ServiceUnavailableException(
        `Stock dividend pool query failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private toPoolItem(row: StockEventRow) {
    const ticker = String(row['Mã CK'] ?? row.symbol ?? '').trim();
    const dividendValue = Number(row.dividendValue ?? 0);
    const price = Number(row.price ?? 0);
    const yieldPct = price > 0 ? (dividendValue / price) * 100 : 0;
    const exDate = normalizeDate(row.gdkhq_timestamp);
    const days = exDate
      ? Math.max(0, Math.ceil((new Date(exDate).getTime() - startOfToday().getTime()) / 86_400_000))
      : 999;
    const dividendScore = Math.min(45, yieldPct * 4.5);
    const valueScore = Math.min(35, dividendValue / 1000);
    const timingScore = Math.max(0, 20 - Math.min(days, 20));
    const score = Number((dividendScore + valueScore + timingScore).toFixed(2));

    const entryLow = row.tce_entry_low ?? (price > 0 ? roundPrice(price * ENTRY_LOW_FACTOR) : null);
    const entryHigh =
      row.tce_entry_high ?? (price > 0 ? roundPrice(price * ENTRY_HIGH_FACTOR) : null);
    const yieldBoost = Math.min(MAX_TP_UPSIDE, Math.max(BASE_TP_UPSIDE, (yieldPct * 0.5) / 100));
    const targetPrice =
      row.tce_target_price ?? (price > 0 ? roundPrice(price * (1 + yieldBoost)) : null);
    const confidenceScore =
      row.tce_confidence_score ?? calculateConfidence(price, dividendValue, days, score);
    const agentNote =
      row.tce_agent_note ??
      `TCE agent: dividend event ranked; entry ${formatPrice(entryLow)}–${formatPrice(entryHigh)}, TP ${formatPrice(targetPrice)}. Recalculate on next market scan.`;

    return {
      id: String(row._id ?? ''),
      rank: 0,
      ticker,
      exDividendDate: row['Ngày GDKHQ'] ?? exDate ?? '',
      exDividendTimestamp: exDate,
      paymentDate: row['Ngày thực hiện'] ?? null,
      eventContent: row['Nội dung sự kiện'] ?? '',
      dividendRate: row['Tỷ lệ'] ?? '',
      dividendValue,
      price: price || null,
      dividendYieldPct: Number(yieldPct.toFixed(2)),
      score,
      daysToExDate: days,
      entryLow,
      entryHigh,
      targetPrice,
      confidenceScore,
      agentNote,
      agentUpdatedAt: row.tce_agent_updated_at ? normalizeDate(row.tce_agent_updated_at) : null,
    };
  }

  private async getDb() {
    return this.mongo.getDb();
  }

  private getCollectionName() {
    return process.env.MONGO_EVENTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
  }
}

function startOfToday() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function calculateConfidence(price: number, dividendValue: number, days: number, score: number) {
  if (price <= 0 || dividendValue <= 0) return 35;
  const yieldPct = (dividendValue / price) * 100;
  const timing = Math.max(0, Math.min(25, 25 - days));
  return Number(
    Math.min(
      95,
      Math.max(40, 40 + Math.min(30, yieldPct * 3) + timing + Math.min(15, score / 10))
    ).toFixed(1)
  );
}

function roundPrice(value: number) {
  return Number(value.toFixed(2));
}

function formatPrice(value: number | null) {
  return value == null ? '—' : value.toLocaleString('vi-VN');
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
