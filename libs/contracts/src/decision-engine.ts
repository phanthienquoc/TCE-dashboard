export type DecisionAction = 'BUY' | 'SELL' | 'HOLD' | 'WAIT' | 'SKIP';
export type CapitalPoolId = 'A' | 'B' | 'C';

export type DividendEntitlementStatus =
  'UNKNOWN' | 'NOT_ELIGIBLE' | 'AT_RISK' | 'PROTECTED' | 'CONFIRMED';

export type DecisionStockCandidate = {
  symbol: string;
  price: number;
  dividendValue?: number;
  dividendNet?: number;
  dividendRatio?: string | number;
  gdkhqTimestamp?: string;
  exRightDate?: string;
  recordDate?: string;
  paymentDate?: string;
  exchange?: string;
  realPnl?: number;
  realPnlNet?: number;
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
  dividendGross?: number;
  dividendNet?: number;
  exRightDate?: string;
  recordDate?: string;
  paymentDate?: string;
  entitlementStatus?: DividendEntitlementStatus;
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
  entry?: number;
  target?: number;
  invalidation?: number;
  tpPercent?: number;
  maxHoldDays?: number;
  confidence?: number;
  profitNet?: number;
  dividendNet?: number;
  entitlementStatus?: DividendEntitlementStatus;
  candidateId?: string;
  decisionWindowKey?: string;
  decisionId?: string;
  strategyVersion?: string;
  reasons: string[];
  timestamp: string;
};

export type DecisionSnapshot = Readonly<{
  decisionId: string;
  strategyVersion: string;
  decision: TradeDecision;
}>;

export interface DecisionSnapshotRepository {
  save(snapshot: DecisionSnapshot): Promise<void> | void;
  exists(decisionId: string): Promise<boolean> | boolean;
}

export interface DecisionEngine {
  readonly id: string;
  decide(context: DecisionEngineContext): Promise<TradeDecision[]> | TradeDecision[];
}
