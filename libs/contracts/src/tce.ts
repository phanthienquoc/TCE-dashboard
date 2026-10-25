import { AccountOrder, AccountPosition, MarketQuote } from './platform.js';

export interface PositionRepository {
  listOpen(accountId: string): Promise<AccountPosition[]>;
  upsert(position: AccountPosition): Promise<AccountPosition>;
}
export interface OrderRepository {
  list(accountId: string): Promise<AccountOrder[]>;
  upsert(order: AccountOrder): Promise<AccountOrder>;
}
export interface MarketDataService {
  quote(symbol: string): Promise<MarketQuote>;
}
export interface PortfolioService {
  positions(accountId: string): Promise<AccountPosition[]>;
  orders(accountId: string): Promise<AccountOrder[]>;
}

export type TceEngineConfig = {
  enabled: boolean;
  profitTargetPct: number;
  maxTotalAssets: number;
  maxAssetAllocationPct: number;
  buyQuantityStep: number;
  buyFromRemainingBudget: boolean;
};

export type TceEnginePosition = AccountPosition & { costBasis?: number; unrealizedPnlPct?: number };
export type TceEngineCandidate = { symbol: string; rank?: number; price?: number };

export type TceEngineDecision =
  | { action: 'HOLD'; reason: string }
  | { action: 'SELL'; symbol: string; quantity: number; reason: string; profitPct: number }
  | { action: 'BUY'; symbol: string; quantity: number; estimatedValue: number; reason: string };

export type TceEngineAccountState = {
  accountId: string;
  totalAssetsValue: number;
  availableBudget: number;
  positions: TceEnginePosition[];
  candidates: TceEngineCandidate[];
};

export interface TceEnginePort {
  evaluate(state: TceEngineAccountState, config: TceEngineConfig): TceEngineDecision[];
}
