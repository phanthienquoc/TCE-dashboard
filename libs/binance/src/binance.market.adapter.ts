import {
  ContractResult,
  ConnectInput,
  MarketProviderPort,
  MarketQuote,
  PlatformHealth,
} from '@tce/contracts';

export class BinanceMarketAdapter implements MarketProviderPort {
  readonly provider = 'binance';
  async health(_input: ConnectInput): Promise<ContractResult<PlatformHealth>> {
    return {
      ok: true,
      data: { provider: 'binance', available: true, fetchedAt: new Date().toISOString() },
    };
  }
  async quote(symbol: string): Promise<ContractResult<MarketQuote>> {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol.toUpperCase())}`
      );
      if (!response.ok)
        return {
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: `Binance HTTP ${response.status}`,
            retryable: response.status >= 500,
            provider: this.provider,
          },
        };
      const data = (await response.json()) as { symbol: string; price: string };
      return {
        ok: true,
        data: {
          symbol: data.symbol,
          price: Number(data.price),
          timestamp: new Date().toISOString(),
          source: 'binance',
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
          provider: this.provider,
        },
      };
    }
  }
}
