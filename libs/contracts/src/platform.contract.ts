export type PlatformKind = 'ssi' | 'binance' | 'fastapi' | 'supabase' | 'telegram';
export type PlatformHealth = {
  provider: PlatformKind;
  available: boolean;
  latencyMs?: number;
  error?: string;
  fetchedAt: string;
};
export type ConnectInput = { userId: string; environment: string };
export interface PlatformPort {
  readonly provider: PlatformKind;
  connect(input: ConnectInput): Promise<void>;
  health(input: ConnectInput): Promise<PlatformHealth>;
  disconnect(input: ConnectInput): Promise<void>;
}
export interface MarketDataPort extends PlatformPort {
  quote(symbol: string): Promise<MarketQuote>;
}
export interface AccountDataPort extends PlatformPort {
  balance(accountNo: string): Promise<AccountBalance>;
  positions(accountNo: string): Promise<AccountPosition[]>;
  orders(accountNo: string): Promise<AccountOrder[]>;
}
export type MarketQuote = {
  symbol: string;
  price: number;
  timestamp: string;
  source: PlatformKind;
};

// BE contracts intentionally form a superset of the provider SDK models.
// Provider-specific fields are optional so the normalized contract remains portable.
export type AccountBalance = {
  accountNo?: string;
  cash: number;
  equity: number;
  withdrawable: number;
  availableCash?: number;
  totalDebt?: number;
  interestLoan?: number;
  overdueFeeLoan?: number;
  onHoldCash?: number;
  sellUnmatched?: number;
  sellT0?: number;
  sellT1?: number;
  sellT2?: number;
  buyUnmatched?: number;
  buyT0?: number;
  buyT1?: number;
  buyT2?: number;
  advanceCashT0?: number;
  advanceCashT1?: number;
  holdSubscription?: number;
  bankBalance?: number;
  dividend?: number;
  dividendMargin?: number;
  blockCash?: number;
  interestCash?: number;
  limitT0?: number;
  termDeposit?: number;
  source: PlatformKind;
  raw?: unknown;
};

export type AccountPosition = {
  accountId?: string;
  accountNo?: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  sellableQuantity?: number;
  blockQuantity?: number;
  dividendQuantity?: number;
  buyingQuantity?: number;
  boughtQuantity?: number;
  sellingQuantity?: number;
  soldQuantity?: number;
  t1SellQuantity?: number;
  t2SellQuantity?: number;
  mortgageQuantity?: number;
  restrictedQuantity?: number;
  source: PlatformKind;
  raw?: unknown;
};

export type AccountOrder = {
  accountId?: string;
  accountNo?: string;
  externalId: string;
  clientRequestId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType?: string;
  quantity: number;
  osQuantity?: number;
  filledQuantity?: number;
  cancelQuantity?: number;
  price?: number;
  avgPrice?: number;
  status: string;
  createdAt?: string;
  modifyTime?: string;
  message?: string;
  source: PlatformKind;
  raw?: unknown;
};
