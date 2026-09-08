import { Injectable } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';
import type { RecycledCapitalEntry } from './capital-recycling.service';

const COLLECTION = 'dre_recycled_capital';

type RecycledCapitalDocument = RecycledCapitalEntry & { _id?: string };

@Injectable()
export class CapitalRecyclingRepository {
  constructor(private readonly mongo: MongoDbClient) {}

  async ensureIndexes(): Promise<void> {
    const db = await this.mongo.getDb();
    await db
      .collection<RecycledCapitalDocument>(COLLECTION)
      .createIndex({ positionId: 1 }, { unique: true, name: 'dre_recycled_position_unique' });
  }

  async record(entry: RecycledCapitalEntry): Promise<RecycledCapitalEntry> {
    const db = await this.mongo.getDb();
    await db
      .collection<RecycledCapitalDocument>(COLLECTION)
      .replaceOne({ _id: entry.positionId }, { ...entry, _id: entry.positionId }, { upsert: true });
    return entry;
  }

  async listForCampaign(campaignId: string): Promise<RecycledCapitalEntry[]> {
    const db = await this.mongo.getDb();
    return db
      .collection<RecycledCapitalDocument>(COLLECTION)
      .find({ campaignId })
      .sort({ confirmedAt: 1 })
      .toArray()
      .then(rows => rows.map(({ _id: _ignored, ...entry }) => entry));
  }
}
