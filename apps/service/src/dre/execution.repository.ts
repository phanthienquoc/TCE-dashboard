import { Injectable } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';
import type { DreAction } from './dre.types';

export type DreOrderStatus = 'PENDING' | 'SUBMITTED' | 'PARTIAL' | 'FILLED' | 'FAILED' | 'UNKNOWN' | 'CANCELLED';
export interface RollingActionRecord extends DreAction { runId: string; status: DreOrderStatus; externalId?: string; submittedAt?: string; filledQuantity?: number; error?: string; }
export interface DailyRunRecord { runId: string; accountId: string; campaignId: string; mode: 'DRY_RUN' | 'LIVE'; status: string; createdAt: string; }

const ACTIONS = 'dre_rolling_actions';
const RUNS = 'dre_daily_runs';

@Injectable()
export class DreExecutionRepository {
  constructor(private readonly mongo: MongoDbClient) {}
  async ensureIndexes(): Promise<void> {
    const db = await this.mongo.getDb();
    await db.collection(ACTIONS).createIndex({ idempotencyKey: 1 }, { unique: true, name: 'dre_action_idempotency_unique' });
    await db.collection(ACTIONS).createIndex({ campaignId: 1, positionId: 1 });
    await db.collection(RUNS).createIndex({ runId: 1 }, { unique: true, name: 'dre_run_unique' });
  }
  async getAction(key: string): Promise<RollingActionRecord | null> { return this.mongo.getDb().then(db => db.collection<RollingActionRecord>(ACTIONS).findOne({ idempotencyKey: key })); }
  async saveAction(record: RollingActionRecord): Promise<void> { const db = await this.mongo.getDb(); await db.collection<RollingActionRecord>(ACTIONS).replaceOne({ idempotencyKey: record.idempotencyKey }, record, { upsert: true }); }
  async saveRun(record: DailyRunRecord): Promise<void> { const db = await this.mongo.getDb(); await db.collection<DailyRunRecord>(RUNS).replaceOne({ runId: record.runId }, record, { upsert: true }); }
  async listPending(): Promise<RollingActionRecord[]> { const db = await this.mongo.getDb(); return db.collection<RollingActionRecord>(ACTIONS).find({ status: { $in: ['PENDING', 'UNKNOWN', 'PARTIAL'] } }).sort({ submittedAt: 1 }).toArray(); }
}
