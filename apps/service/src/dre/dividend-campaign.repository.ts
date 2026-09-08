import { Injectable } from '@nestjs/common';
import { MongoDbClient } from '../db/mongodb.client';
import type { DreRepositoryPort } from './dre.contracts';
import type { DividendEventRef, DreCampaign, DrePositionState, RollingPosition } from './dre.types';
import { campaignEventKey, normalizeSymbol } from './dividend-campaign';

const CAMPAIGN_COLLECTION = 'dre_dividend_campaigns';
const POSITION_COLLECTION = 'dre_rolling_positions';

type DividendCampaignDocument = Omit<DreCampaign, 'id'> & { _id?: string; campaignKey: string };
type RollingPositionDocument = Omit<RollingPosition, 'id'> & { _id?: string };

@Injectable()
export class DividendCampaignRepository implements DreRepositoryPort {
  constructor(private readonly mongo: MongoDbClient) {}

  async ensureIndexes(): Promise<void> {
    const db = await this.mongo.getDb();
    await db
      .collection<DividendCampaignDocument>(CAMPAIGN_COLLECTION)
      .createIndex({ campaignKey: 1 }, { unique: true, name: 'dre_campaign_event_unique' });
    await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .createIndex(
        { campaignId: 1, sequence: 1 },
        { unique: true, name: 'dre_position_sequence_unique' }
      );
  }

  async findCampaignByEvent(event: DividendEventRef): Promise<DreCampaign | null> {
    const db = await this.mongo.getDb();
    const row = await db
      .collection<DividendCampaignDocument>(CAMPAIGN_COLLECTION)
      .findOne({ campaignKey: campaignEventKey(event) });
    return row ? this.toCampaignDomain(row) : null;
  }

  async saveCampaign(campaign: DreCampaign): Promise<void> {
    const event = {
      ...campaign.event,
      symbol: normalizeSymbol(campaign.event.symbol),
      eventId: campaign.event.eventId.trim(),
      eventDate: campaign.event.eventDate.trim(),
    };
    const document = {
      ...campaign,
      _id: campaign.id,
      campaignKey: campaignEventKey(event),
      event,
    };
    const db = await this.mongo.getDb();
    await db
      .collection<DividendCampaignDocument>(CAMPAIGN_COLLECTION)
      .replaceOne({ campaignKey: document.campaignKey }, document, { upsert: true });
  }

  async listCampaigns(status?: DreCampaign['status']): Promise<DreCampaign[]> {
    const db = await this.mongo.getDb();
    const rows = await db
      .collection<DividendCampaignDocument>(CAMPAIGN_COLLECTION)
      .find(status ? { status } : {})
      .sort({ 'event.eventDate': 1, createdAt: 1 })
      .toArray();
    return rows.map(row => this.toCampaignDomain(row));
  }

  async updateCampaignStatus(
    id: string,
    status: DreCampaign['status'],
    updatedAt: string
  ): Promise<DreCampaign | null> {
    const db = await this.mongo.getDb();
    const result = await db
      .collection<DividendCampaignDocument>(CAMPAIGN_COLLECTION)
      .findOneAndUpdate({ _id: id }, { $set: { status, updatedAt } }, { returnDocument: 'after' });
    return result ? this.toCampaignDomain(result) : null;
  }

  async listPositions(campaignId: string): Promise<RollingPosition[]> {
    const db = await this.mongo.getDb();
    const rows = await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .find({ campaignId })
      .sort({ sequence: 1 })
      .toArray();
    return rows.map(row => this.toPositionDomain(row));
  }

  async findPosition(campaignId: string, sequence: number): Promise<RollingPosition | null> {
    const db = await this.mongo.getDb();
    const row = await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .findOne({ campaignId, sequence });
    return row ? this.toPositionDomain(row) : null;
  }

  async findPositionById(id: string): Promise<RollingPosition | null> {
    const db = await this.mongo.getDb();
    const row = await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .findOne({ _id: id });
    return row ? this.toPositionDomain(row) : null;
  }

  async savePosition(position: RollingPosition): Promise<void> {
    const db = await this.mongo.getDb();
    await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .replaceOne({ _id: position.id }, { ...position, _id: position.id }, { upsert: true });
  }

  async updatePositionState(id: string, state: DrePositionState): Promise<RollingPosition | null> {
    return this.updatePositionLifecycle(id, { state });
  }

  async updatePositionLifecycle(
    id: string,
    changes: Partial<
      Pick<
        RollingPosition,
        | 'state'
        | 'entryAt'
        | 'settlementAt'
        | 'availableAt'
        | 'soldAt'
        | 'realizedPnl'
        | 'recycledCapital'
      >
    >
  ): Promise<RollingPosition | null> {
    const db = await this.mongo.getDb();
    const result = await db
      .collection<RollingPositionDocument>(POSITION_COLLECTION)
      .findOneAndUpdate({ _id: id }, { $set: changes }, { returnDocument: 'after' });
    return result ? this.toPositionDomain(result) : null;
  }

  private toCampaignDomain(row: DividendCampaignDocument): DreCampaign {
    const { _id: _ignored, campaignKey: _key, ...campaign } = row;
    return { ...campaign, id: row._id ?? campaignKeyFallback(row) };
  }

  private toPositionDomain(row: RollingPositionDocument): RollingPosition {
    const { _id, ...position } = row;
    return { ...position, id: _id ?? positionIdFallback(position) };
  }
}

function campaignKeyFallback(row: DividendCampaignDocument): string {
  return campaignEventKey(row.event);
}

function positionIdFallback(row: Omit<RollingPosition, 'id'>): string {
  return `${row.campaignId}-${row.sequence}`;
}
