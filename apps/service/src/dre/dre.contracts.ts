import type {
  DreAction,
  DreCampaign,
  DividendEventRef,
  RollingPosition,
  TceDecision,
  DrePositionState,
} from './dre.types';

/** Read-only boundary from TCE Core into DRE. */
export interface TceCorePort {
  evaluate(symbol: string, context: Record<string, unknown>): Promise<TceDecision | null>;
}

/** DRE owns campaign/sequence state; it does not own strategy calculations. */
export interface DreRepositoryPort {
  findCampaignByEvent(event: DividendEventRef): Promise<DreCampaign | null>;
  saveCampaign(campaign: DreCampaign): Promise<void>;
  listCampaigns(status?: DreCampaign['status']): Promise<DreCampaign[]>;
  updateCampaignStatus(id: string, status: DreCampaign['status'], updatedAt: string): Promise<DreCampaign | null>;
  listPositions(campaignId: string): Promise<RollingPosition[]>;
  findPosition(campaignId: string, sequence: number): Promise<RollingPosition | null>;
  findPositionById(id: string): Promise<RollingPosition | null>;
  savePosition(position: RollingPosition): Promise<void>;
  updatePositionState(id: string, state: DrePositionState): Promise<RollingPosition | null>;
  updatePositionLifecycle(
    id: string,
    changes: Partial<Pick<RollingPosition, 'state' | 'entryAt' | 'settlementAt' | 'availableAt' | 'soldAt'>>,
  ): Promise<RollingPosition | null>;
}

/** Cash/portfolio read boundary. Execution is deliberately absent in P0. */
export interface CashPortfolioPort {
  getSettledCash(accountId: string): Promise<number>;
}

/** Daily Agent consumes plans; an implementation may later adapt this to a broker. */
export interface DreExecutionPort {
  execute(action: DreAction): Promise<{ accepted: boolean; externalId?: string }>;
}

/** Calendar abstraction keeps T+2 policy out of domain objects. */
export interface SettlementCalendarPort {
  addSettlementDays(start: Date, days: number): Date;
}
