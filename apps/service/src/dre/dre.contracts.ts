import type {
  DreAction,
  DreCampaign,
  DividendEventRef,
  RollingPosition,
  TceDecision,
} from './dre.types';

/** Read-only boundary from TCE Core into DRE. */
export interface TceCorePort {
  evaluate(symbol: string, context: Record<string, unknown>): Promise<TceDecision | null>;
}

/** DRE owns campaign/sequence state; it does not own strategy calculations. */
export interface DreRepositoryPort {
  findCampaignByEvent(event: DividendEventRef): Promise<DreCampaign | null>;
  saveCampaign(campaign: DreCampaign): Promise<void>;
  listPositions(campaignId: string): Promise<RollingPosition[]>;
  savePosition(position: RollingPosition): Promise<void>;
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
