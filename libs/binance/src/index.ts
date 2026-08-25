export type BinanceSymbol = string;

export type BinanceMarketSnapshot = {
  symbol: BinanceSymbol;
  price: number;
  timestamp: number;
};

export { BinanceFuturesExecutionAdapter } from './binance.futures.execution.adapter';
