import { Injectable } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';
import type { DreRepositoryPort } from './dre.contracts';
import type { DividendEventRef, DreCampaign, RollingPosition } from './dre.types';
import { campaignEventKey, normalizeSymbol } from './dividend-campaign';

const COLLECTION = 'dre_dividend_campaigns';

type DividendCampaignDocument = Omit<DreCampaign, 'id'> & {
  _id: string;
  campaignKey: string;
};

@Injectable()
export class DividendCampaignRepository implements DreRepositoryPort {
  constructor(private readonly mongo: MongoDbClient) {}

  async ensureIndexes(): Promise<void> {
    const db = await this.mongo.getDb();
    await db.collection<DividendCampaignDocument>(COLLECTION).createIndex(
      { campaignKey: 1 },
      { unique: true, name: 'dre_campaign_event_unique' },
    );
  }

  async findCampaignByEvent(event: DividendEventRef): Promise<DreCampaign | null> {
    const db = await this.mongo.getDb();
    const row = await db.collection<DividendCampaignDocument>(COLLECTION).findOne({
      campaignKey: campaignEventKey(event),
    });
    return row ? this.toDomain(row) : null;
  }

  async saveCampaign(campaign: DreCampaign): Promise<void> {
    const event = {
      ...campaign.event,
      symbol: normalizeSymbol(campaign.event.symbol),
      eventId: campaign.event.eventId.trim(),
      eventDate: campaign.event.eventDate.trim(),
    };
    const document: DividendCampaignDocument = {
      ...campaign,
      _id: campaign.id,
      campaignKey: campaignEventKey(event),
      event,
    };

    const db = await this.mongo.getDb();
    await db.collection<DividendCampaignDocument>(COLLECTION).replaceOne(
      { campaignKey: document.campaignKey },
      document,
      { upsert: true },
    );
  }

  async listCampaigns(status?: DreCampaign['status']): Promise<DreCampaign[]> {
    const db = await this.mongo.getDb();
    const rows = await db
      .collection<DividendCampaignDocument>(COLLECTION)
      .find(status ? { status } : {})
      .sort({ 'event.eventDate': 1, createdAt: 1 })
      .toArray();
    return rows.map(row => this.toDomain(row));
  }

  async updateCampaignStatus(
    id: string,
    status: DreCampaign['status'],
    updatedAt: string,
  ): Promise<DreCampaign | null> {
    const db = await this.mongo.getDb();
    const result = await db.collection<DividendCampaignDocument>(COLLECTION).findOneAndUpdate(
      { _id: id },
      { $set: { status, updatedAt } },
      { returnDocument: 'after' },
    );
    return result ? this.toDomain(result) : null;
  }

  async listPositions(_campaignId: string): Promise<RollingPosition[]> {
    return [];
  }

  async savePosition(_position: RollingPosition): Promise<void> {
    throw new Error('Rolling position persistence is introduced in DRE P2');
  }

  private toDomain(row: DividendCampaignDocument): DreCampaign {
    const { _id: _ignored, campaignKey: _key, ...campaign } = row;
    return campaign;
  }
}
