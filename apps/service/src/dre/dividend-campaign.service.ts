import { Injectable } from '@nestjs/common';
import type { DreCampaignStatus, DividendEventRef } from './dre.types';
import {
  createDividendCampaign,
  type DividendCampaign,
  type DividendCampaignInput,
} from './dividend-campaign';
import { DividendCampaignRepository } from './dividend-campaign.repository';

@Injectable()
export class DividendCampaignService {
  constructor(private readonly repository: DividendCampaignRepository) {}

  async create(input: DividendCampaignInput): Promise<DividendCampaign> {
    await this.repository.ensureIndexes();
    const existing = await this.repository.findCampaignByEvent(input.event);
    if (existing) return existing as DividendCampaign;

    const campaign = createDividendCampaign(input);
    await this.repository.saveCampaign(campaign);
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
    return (await this.repository.updateCampaignStatus(
      id,
      status,
      new Date().toISOString()
    )) as DividendCampaign | null;
  }
}
