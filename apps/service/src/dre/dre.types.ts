export type DreCampaignStatus = 'ACTIVE' | 'PAUSED' | 'GAP' | 'COMPLETED' | 'INVALIDATED';

export type DrePositionState =
  | 'PLANNED'
  | 'NEXT'
  | 'BUY_PENDING'
  | 'BOUGHT'
  | 'T+2_PENDING'
  | 'AVAILABLE'
  | 'TP_REACHED'
  | 'SELL_APPROVED'
  | 'SELL_PENDING'
  | 'SOLD'
  | 'COMPLETED'
  | 'MISSED';

export type DreActionType = 'BUY' | 'SELL';

/** Strategy output owned by TCE Core. DRE may consume, never redefine it. */
export interface TceDecision {
  symbol: string;
  entryPrice: number;
  takeProfitPrice: number;
  riskPercent: number;
  quantity: number;
  generatedAt: string;
}

/** Dividend event identity. The same symbol may have multiple distinct events. */
export interface DividendEventRef {
  symbol: string;
  eventId: string;
  eventDate: string;
  source?: string;
}

export interface DreCampaign {
  id: string;
  event: DividendEventRef;
  status: DreCampaignStatus;
  /** Reference/configuration only; TCE Core remains authoritative for TP. */
  targetTpMinPercent: number;
  targetTpMaxPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface RollingPosition {
  id: string;
  campaignId: string;
  sequence: number;
  symbol: string;
  state: DrePositionState;
  tceDecision?: TceDecision;
  entryAt?: string;
  settlementAt?: string;
  availableAt?: string;
  soldAt?: string;
  realizedPnl?: number;
  recycledCapital?: number;
}

export interface DreAction {
  idempotencyKey: string;
  campaignId: string;
  positionId: string;
  type: DreActionType;
  quantity: number;
  reason: string;
}
