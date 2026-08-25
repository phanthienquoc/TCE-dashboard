import { ContractResult } from './errors.contract';
import { AccountBalance, AccountOrder, AccountPosition, ConnectInput, MarketQuote, PlatformHealth } from './platform.contract';
import { FuturesEntryOrderInput, FuturesOrderResult, FuturesTpSlInput } from './execution';

export interface BrokerPort {
  readonly provider: string;
  connect(input: ConnectInput): Promise<ContractResult<void>>;
  health(input: ConnectInput): Promise<ContractResult<PlatformHealth>>;
  balance(accountNo: string): Promise<ContractResult<AccountBalance>>;
  positions(accountNo: string): Promise<ContractResult<AccountPosition[]>>;
  orders(accountNo: string): Promise<ContractResult<AccountOrder[]>>;
  disconnect(input: ConnectInput): Promise<ContractResult<void>>;
}

export interface MarketProviderPort {
  readonly provider: string;
  health(input: ConnectInput): Promise<ContractResult<PlatformHealth>>;
  quote(symbol: string): Promise<ContractResult<MarketQuote>>;
}

export interface FuturesExecutionPort {
  readonly provider: 'binance';
  placeEntry(input: FuturesEntryOrderInput): Promise<ContractResult<FuturesOrderResult>>;
  placeTakeProfit(input: FuturesTpSlInput): Promise<ContractResult<FuturesOrderResult>>;
  placeStopLoss(input: FuturesTpSlInput): Promise<ContractResult<FuturesOrderResult>>;
}

export interface DashboardSourcePort {
  readonly source: string;
  snapshot(userId: string): Promise<ContractResult<unknown>>;
}
