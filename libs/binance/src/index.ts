export type BinanceSymbol = string;

export type BinanceMarketSnapshot = {
  symbol: BinanceSymbol;
  price: number;
  timestamp: number;
};
