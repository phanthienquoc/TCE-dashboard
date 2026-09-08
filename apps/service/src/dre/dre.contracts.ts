import type {
  DreAction,
  DreCampaign,
  DividendEventRef,
  RollingPosition,
  TceDecision,
  DrePositionState,
} from './dre.types';

export interface TceCorePort {
  evaluate(symbol: string, context: Record<string, unknown>): Promise<TceDecision | null>;
}

export interface DreRepositoryPort {
  findCampaignByEvent(event: DividendEventRef): Promise<DreCampaign | null>;
  saveCampaign(campaign: DreCampaign): Promise<void>;
  listCampaigns(status?: DreCampaign['status']): Promise<DreCampaign[]>;
  updateCampaignStatus(
    id: string,
    status: DreCampaign['status'],
    updatedAt: string
  ): Promise<DreCampaign | null>;
  listPositions(campaignId: string): Promise<RollingPosition[]>;
  findPosition(campaignId: string, sequence: number): Promise<RollingPosition | null>;
  findPositionById(id: string): Promise<RollingPosition | null>;
  savePosition(position: RollingPosition): Promise<void>;
  updatePositionState(id: string, state: DrePositionState): Promise<RollingPosition | null>;
  updatePositionLifecycle(
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
  ): Promise<RollingPosition | null>;
}

export interface CashPortfolioPort {
  getSettledCash(accountId: string): Promise<number>;
}

export interface DreExecutionPort {
  execute(action: DreAction): Promise<{ accepted: boolean; externalId?: string }>;
}

export interface SettlementCalendarPort {
  addSettlementDays(start: Date, days: number): Date;
}
