import { ContractResult } from './errors.js';

export type FuturesSide = 'BUY' | 'SELL';
export type FuturesOrderType =
  'LIMIT' | 'MARKET' | 'STOP' | 'TAKE_PROFIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
export type FuturesPositionSide = 'BOTH' | 'LONG' | 'SHORT';
export type FuturesEntryOrderInput = {
  symbol: string;
  side: FuturesSide;
  positionSide?: FuturesPositionSide;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
};
export type FuturesTpSlInput = {
  symbol: string;
  side: FuturesSide;
  positionSide?: FuturesPositionSide;
  quantity?: number;
  triggerPrice: number;
  limitPrice?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
};
export type FuturesCancelOrderInput = {
  symbol: string;
  orderId?: string | number;
  clientOrderId?: string;
};
export type FuturesOrderResult = {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  status: string;
  side: FuturesSide;
  type: FuturesOrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  positionSide?: FuturesPositionSide;
  source: 'binance';
};
export type FuturesCancelOrderResult = {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  status: string;
  source: 'binance';
};
export interface FuturesExecutionPort {
  readonly provider: 'binance';
  placeEntry(input: FuturesEntryOrderInput): Promise<ContractResult<FuturesOrderResult>>;
  placeTakeProfit(input: FuturesTpSlInput): Promise<ContractResult<FuturesOrderResult>>;
  placeStopLoss(input: FuturesTpSlInput): Promise<ContractResult<FuturesOrderResult>>;
  cancelOrder(input: FuturesCancelOrderInput): Promise<ContractResult<FuturesCancelOrderResult>>;
}
