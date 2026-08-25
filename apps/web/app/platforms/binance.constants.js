export const BINANCE_FUTURES_URLS = Object.freeze({
  production: 'https://fapi.binance.com',
  testnet: 'https://testnet.binancefuture.com',
});

export function getBinanceFuturesUrl(environment) {
  if (environment !== 'production' && environment !== 'testnet') {
    throw new Error(`Unsupported Binance environment: ${environment}`);
  }
  return BINANCE_FUTURES_URLS[environment];
}
