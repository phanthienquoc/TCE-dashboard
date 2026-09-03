export type BinanceSymbol = string;

export type BinanceMarketSnapshot = {
  symbol: BinanceSymbol;
  price: number;
  timestamp: number;
};

export { BINANCE_FUTURES_URLS, getBinanceFuturesUrl } from './binance.constants';
export type { BinanceFuturesEnvironment } from './binance.constants';
export { BinanceFuturesExecutionAdapter } from './binance.futures.execution.adapter';
export { BinanceFuturesStateAdapter } from './binance.futures.state.adapter';
export { BinanceFuturesUserDataStream } from './binance.futures.user-data-stream';
export type { BinanceFuturesUserDataEvent } from './binance.futures.user-data-stream';
export type { BinancePosition, BinanceOpenOrder } from './binance.futures.state.adapter';
