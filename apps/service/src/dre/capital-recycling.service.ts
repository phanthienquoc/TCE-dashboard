import { Injectable } from '@nestjs/common';
import { CapitalRecyclingRepository } from './capital-recycling.repository';
import { DreLifecycleEventService } from './dre-lifecycle-event.service';

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
  constructor(
    private readonly repository: CapitalRecyclingRepository,
    private readonly lifecycleEvents: DreLifecycleEventService
  ) {}

  async recordConfirmedSale(entry: RecycledCapitalEntry): Promise<RecycledCapitalEntry> {
    if (!entry.positionId || !entry.campaignId)
      throw new Error('Recycled capital requires position and campaign');
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0)
      throw new Error('Invalid recycled quantity');
    if (!Number.isFinite(entry.salePrice) || entry.salePrice <= 0)
      throw new Error('Invalid sale price');
    if (!Number.isFinite(entry.realizedPnl)) throw new Error('Invalid realized P&L');
    if (!Number.isFinite(entry.recycledCapital) || entry.recycledCapital < 0)
      throw new Error('Invalid recycled capital');
    if (!Number.isFinite(Date.parse(entry.confirmedAt)))
      throw new Error('Invalid confirmed sale timestamp');
    await this.repository.ensureIndexes();
    const existing = (await this.repository.listForCampaign(entry.campaignId)).find(
      item => item.positionId === entry.positionId
    );
    const recorded = existing ?? (await this.repository.record(entry));
    await this.lifecycleEvents.publish({
      campaignId: recorded.campaignId,
      lifecycleState: 'CAPITAL_RECYCLED',
      aggregateId: recorded.positionId,
      occurredAt: recorded.confirmedAt,
      eventKey: `${recorded.positionId}:CAPITAL_RECYCLED:${recorded.confirmedAt}`,
      reason: 'confirmed_sale_capital_recycled',
    });
    return recorded;
  }

  async getForCampaign(campaignId: string): Promise<RecycledCapitalEntry[]> {
    return this.repository.listForCampaign(campaignId);
  }

  async getRecycledCapital(campaignId: string): Promise<number> {
    const entries = await this.getForCampaign(campaignId);
    return entries.reduce((total, entry) => total + entry.recycledCapital, 0);
  }
}
