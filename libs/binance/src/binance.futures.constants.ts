export const BINANCE_FUTURES_URLS = Object.freeze({
  production: 'https://fapi.binance.com',
  testnet: 'https://testnet.binancefuture.com',
} as const);

export type BinanceFuturesEnvironment = keyof typeof BINANCE_FUTURES_URLS;

export function getBinanceFuturesUrl(environment: string = 'production'): string {
  if (environment !== 'production' && environment !== 'testnet') {
    throw new Error(`Unsupported Binance environment: ${environment}`);
  }
  return BINANCE_FUTURES_URLS[environment];
}
