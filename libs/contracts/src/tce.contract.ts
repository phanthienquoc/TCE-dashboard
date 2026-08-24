import { AccountOrder, AccountPosition, MarketQuote } from './platform.contract';
export interface PositionRepository { listOpen(accountId: string): Promise<AccountPosition[]>; upsert(position: AccountPosition): Promise<AccountPosition>; }
export interface OrderRepository { list(accountId: string): Promise<AccountOrder[]>; upsert(order: AccountOrder): Promise<AccountOrder>; }
export interface MarketDataService { quote(symbol: string): Promise<MarketQuote>; }
export interface PortfolioService { positions(accountId: string): Promise<AccountPosition[]>; orders(accountId: string): Promise<AccountOrder[]>; }
