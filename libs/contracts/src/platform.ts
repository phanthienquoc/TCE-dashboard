export type PlatformKind = 'ssi' | 'binance' | 'fastapi' | 'supabase' | 'telegram';
export type PlatformHealth = { provider: PlatformKind; available: boolean; latencyMs?: number; error?: string; fetchedAt: string };
export type ConnectInput = { userId: string; environment: string };
export type MarketQuote = { symbol: string; price: number; timestamp: string; source: PlatformKind };
export type AccountBalance = { cash: number; equity: number; withdrawable: number; source: PlatformKind };
export type AccountPosition = { accountId?: string; symbol: string; quantity: number; averagePrice: number; marketPrice?: number; marketValue?: number; unrealizedPnl?: number; source: PlatformKind };
export type AccountOrder = { accountId?: string; externalId: string; symbol: string; side: 'BUY'|'SELL'; quantity: number; price?: number; status: string; createdAt?: string; source: PlatformKind };

export interface PlatformPort { readonly provider: PlatformKind; connect(input: ConnectInput): Promise<void>; health(input: ConnectInput): Promise<PlatformHealth>; disconnect(input: ConnectInput): Promise<void>; }
export interface MarketDataPort extends PlatformPort { quote(symbol: string): Promise<MarketQuote>; }
export interface AccountDataPort extends PlatformPort { balance(accountNo: string): Promise<AccountBalance>; positions(accountNo: string): Promise<AccountPosition[]>; orders(accountNo: string): Promise<AccountOrder[]>; }
