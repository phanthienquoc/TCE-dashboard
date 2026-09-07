import { Injectable } from '@nestjs/common';
import { CapitalRecyclingRepository } from './capital-recycling.repository';

export interface RecycledCapitalEntry {
  positionId: string;
  campaignId: string;
  quantity: number;
  salePrice: number;
  realizedPnl: number;
  recycledCapital: number;
  confirmedAt: string;
}

@Injectable()
export class CapitalRecyclingService {
  constructor(private readonly repository: CapitalRecyclingRepository) {}

  async recordConfirmedSale(entry: RecycledCapitalEntry): Promise<RecycledCapitalEntry> {
    if (!entry.positionId || !entry.campaignId) throw new Error('Recycled capital requires position and campaign');
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) throw new Error('Invalid recycled quantity');
    if (!Number.isFinite(entry.salePrice) || entry.salePrice <= 0) throw new Error('Invalid sale price');
    if (!Number.isFinite(entry.realizedPnl)) throw new Error('Invalid realized P&L');
    if (!Number.isFinite(entry.recycledCapital) || entry.recycledCapital < 0) throw new Error('Invalid recycled capital');
    await this.repository.ensureIndexes();
    const existing = (await this.repository.listForCampaign(entry.campaignId)).find(item => item.positionId === entry.positionId);
    if (existing) return existing;
    return this.repository.record(entry);
  }

  async getForCampaign(campaignId: string): Promise<RecycledCapitalEntry[]> {
    return this.repository.listForCampaign(campaignId);
  }

  async getRecycledCapital(campaignId: string): Promise<number> {
    const entries = await this.getForCampaign(campaignId);
    return entries.reduce((total, entry) => total + entry.recycledCapital, 0);
  }
}
