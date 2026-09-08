import { Injectable } from '@nestjs/common';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DreExecutionRepository, type DreOrderStatus } from './execution.repository';
import { SafeOrderExecutionService, type BrokerStatePort } from './safe-order-execution.service';

export interface DreHealthSnapshot {
  enabled: boolean;
  liveExecutionEnabled: boolean;
  campaigns: { total: number; active: number; gaps: number };
  positions: { total: number; pendingSettlement: number; available: number; missed: number };
  orders: { pending: number; unknown: number; partial: number; failed: number };
  checkedAt: string;
}

@Injectable()
export class DreProductionService {
  readonly enabled = process.env.DRE_ENABLED !== 'false';
  readonly liveExecutionEnabled = process.env.DRE_LIVE_EXECUTION === 'true';

  constructor(
    private readonly campaigns: DividendCampaignRepository,
    private readonly executions: DreExecutionRepository,
    private readonly safeExecution: SafeOrderExecutionService
  ) {}

  async health(): Promise<DreHealthSnapshot> {
    const campaignRows = await this.campaigns.listCampaigns();
    const positions = (
      await Promise.all(campaignRows.map(c => this.campaigns.listPositions(c.id)))
    ).flat();
    const pending = await this.executions.listPending();
    return {
      enabled: this.enabled,
      liveExecutionEnabled: this.liveExecutionEnabled,
      campaigns: {
        total: campaignRows.length,
        active: campaignRows.filter(c => c.status === 'ACTIVE').length,
        gaps: campaignRows.filter(c => c.status === 'GAP').length,
      },
      positions: {
        total: positions.length,
        pendingSettlement: positions.filter(p => p.state === 'T+2_PENDING').length,
        available: positions.filter(p => p.state === 'AVAILABLE').length,
        missed: positions.filter(p => p.state === 'MISSED').length,
      },
      orders: {
        pending: pending.filter(a => a.status === 'PENDING').length,
        unknown: pending.filter(a => a.status === 'UNKNOWN').length,
        partial: pending.filter(a => a.status === 'PARTIAL').length,
        failed: 0,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  async recoverUnknown(externalId: string, broker: BrokerStatePort): Promise<DreOrderStatus> {
    return this.safeExecution.reconcile(externalId, broker);
  }

  assertProductionSafety(mode: 'DRY_RUN' | 'LIVE'): void {
    if (mode === 'LIVE' && !this.liveExecutionEnabled)
      throw new Error('DRE live execution is disabled by configuration');
    if (!this.enabled) throw new Error('DRE is disabled by configuration');
  }
}
