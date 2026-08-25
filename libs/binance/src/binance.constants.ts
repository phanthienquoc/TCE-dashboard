export const BINANCE_FUTURES_URLS = {
  production: 'https://fapi.binance.com',
  testnet: 'https://testnet.binancefuture.com',
} as const;

export type BinanceFuturesEnvironment = keyof typeof BINANCE_FUTURES_URLS;

export const getBinanceFuturesUrl = (environment: BinanceFuturesEnvironment) =>
  BINANCE_FUTURES_URLS[environment];
