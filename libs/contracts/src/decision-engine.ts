export type DecisionAction = 'BUY' | 'SELL' | 'WAIT' | 'SKIP';
export type CapitalPoolId = 'A' | 'B' | 'C';

export type DecisionStockCandidate = {
  symbol: string;
  price: number;
  dividendValue?: number;
  dividendRatio?: string | number;
  gdkhqTimestamp?: string;
  exchange?: string;
  realPnl?: number;
  [key: string]: unknown;
};

export type DecisionCapitalState = {
  totalCapital: number;
  availableCash: number;
  pendingCash: number;
  stockSellableValue: number;
  stockPendingT2Value: number;
};

export type DecisionPoolState = {
  pool: CapitalPoolId;
  allocatedCapital: number;
  availableCapital: number;
  pendingT2Capital: number;
  occupiedSlots: number;
  totalSlots: number;
};

export type DecisionPositionState = {
  symbol: string;
  pool: CapitalPoolId;
  slot: string;
  quantity: number;
  entryPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  sellableAt?: string;
  status?: string;
};

export type DecisionEngineContext = {
  timestamp: string;
  candidates: DecisionStockCandidate[];
  capital: DecisionCapitalState;
  pools: DecisionPoolState[];
  positions: DecisionPositionState[];
  config?: Record<string, unknown>;
};

export type TradeDecision = {
  engine: string;
  decision: DecisionAction;
  symbol?: string;
  pool?: CapitalPoolId;
  slot?: string;
  capital?: number;
  maxPrice?: number;
  tpPercent?: number;
  maxHoldDays?: number;
  confidence?: number;
  reasons: string[];
  timestamp: string;
};

export interface DecisionEngine {
  readonly id: string;
  decide(context: DecisionEngineContext): Promise<TradeDecision[]> | TradeDecision[];
}
