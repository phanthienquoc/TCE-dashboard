import { ContractResult } from './errors.contract';
import {
  AccountBalance,
  AccountOrder,
  AccountPosition,
  ConnectInput,
  MarketQuote,
  PlatformHealth,
} from './platform.contract';

export type BrokerOrderSide = 'BUY' | 'SELL';
export type BrokerOrderType = 'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';

export type BrokerOrderRequest = {
  accountNo: string;
  symbol: string;
  side: BrokerOrderSide;
  quantity: number;
  orderType: BrokerOrderType;
  price?: number;
  clientRequestId?: string;
};

export type BrokerOrderResult = {
  orderId?: string;
  clientRequestId?: string;
  status: string;
  confirmed?: boolean;
  providerStatus?: string;
  confirmedOrderId?: string;
  message?: string;
};

export interface BrokerPort {
  readonly provider: string;
  connect(input: ConnectInput): Promise<ContractResult<void>>;
  health(input: ConnectInput): Promise<ContractResult<PlatformHealth>>;
  balance(accountNo: string): Promise<ContractResult<AccountBalance>>;
  positions(accountNo: string): Promise<ContractResult<AccountPosition[]>>;
  orders(accountNo: string): Promise<ContractResult<AccountOrder[]>>;
  placeOrder(request: BrokerOrderRequest): Promise<ContractResult<BrokerOrderResult>>;
  disconnect(input: ConnectInput): Promise<ContractResult<void>>;
}

export interface MarketProviderPort {
  readonly provider: string;
  health(input: ConnectInput): Promise<ContractResult<PlatformHealth>>;
  quote(symbol: string): Promise<ContractResult<MarketQuote>>;
}

export interface DashboardSourcePort {
  readonly source: string;
  snapshot(userId: string): Promise<ContractResult<unknown>>;
}
