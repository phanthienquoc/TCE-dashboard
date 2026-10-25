import { Injectable } from '@nestjs/common';
import type { DreCampaignStatus, DividendEventRef } from './dre.types';
import {
  createDividendCampaign,
  type DividendCampaign,
  type DividendCampaignInput,
} from './dividend-campaign';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DreLifecycleEventService } from './dre-lifecycle-event.service';

@Injectable()
export class DividendCampaignService {
  constructor(
    private readonly repository: DividendCampaignRepository,
    private readonly lifecycleEvents: DreLifecycleEventService
  ) {}

  async create(input: DividendCampaignInput): Promise<DividendCampaign> {
    await this.repository.ensureIndexes();
    const existing = await this.repository.findCampaignByEvent(input.event);
    if (existing) return existing as DividendCampaign;

    const campaign = createDividendCampaign(input);
    await this.repository.saveCampaign(campaign);
    await this.lifecycleEvents.publish({
      campaignId: campaign.id,
      lifecycleState: campaign.status,
      aggregateId: campaign.id,
      occurredAt: campaign.updatedAt,
      eventKey: `campaign:${campaign.status}:${campaign.updatedAt}`,
      reason: 'campaign_created',
    });
    return campaign;
  }

  async ensureForStockEvent(event: DividendEventRef): Promise<DividendCampaign> {
    return this.create({ event });
  }

  async findByEvent(event: DividendEventRef): Promise<DividendCampaign | null> {
    return (await this.repository.findCampaignByEvent(event)) as DividendCampaign | null;
  }

  async list(status?: DreCampaignStatus): Promise<DividendCampaign[]> {
    return (await this.repository.listCampaigns(status)).map(
      campaign => campaign as DividendCampaign
    );
  }

  async updateStatus(id: string, status: DreCampaignStatus): Promise<DividendCampaign | null> {
    const updated = (await this.repository.updateCampaignStatus(
      id,
      status,
      new Date().toISOString()
    )) as DividendCampaign | null;
    if (updated) {
      await this.lifecycleEvents.publish({
        campaignId: updated.id,
        lifecycleState: updated.status,
        aggregateId: updated.id,
        occurredAt: updated.updatedAt,
        eventKey: `campaign:${updated.status}:${updated.updatedAt}`,
        reason: 'campaign_status_updated',
      });
    }
    return updated;
  }
}
