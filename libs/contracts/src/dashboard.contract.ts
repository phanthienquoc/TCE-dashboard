import { AccountBalance, AccountOrder, AccountPosition, MarketQuote } from './platform.contract';
export type DashboardSourceKind = 'supabase' | 'ssi' | 'fastapi';
export type SourceResult<T> = {
  source: DashboardSourceKind;
  available: boolean;
  data: T;
  fetchedAt: string;
  error?: string;
};
export type DashboardSnapshot = {
  account: SourceResult<Record<string, unknown>>;
  positions: SourceResult<AccountPosition[]>;
  orders: SourceResult<AccountOrder[]>;
  quotes: SourceResult<MarketQuote[]>;
  balance: SourceResult<AccountBalance>;
  pools: SourceResult<unknown[]>;
  nextPositions: SourceResult<unknown[]>;
};
export interface DashboardDataSource {
  readonly source: DashboardSourceKind;
  getSnapshot(userId: string): Promise<Partial<DashboardSnapshot>>;
}
