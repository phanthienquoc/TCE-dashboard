import {
  ConnectInput,
  ContractResult,
  MarketProviderPort,
  MarketQuote,
  PlatformHealth,
} from '@tce/contracts';

export class FastApiMarketAdapter implements MarketProviderPort {
  readonly provider = 'fastapi';
  constructor(private readonly baseUrl: string) {}
  async health(_input: ConnectInput): Promise<ContractResult<PlatformHealth>> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/health`);
      return response.ok
        ? {
            ok: true,
            data: {
              provider: 'fastapi',
              available: true,
              latencyMs: Date.now() - started,
              fetchedAt: new Date().toISOString(),
            },
          }
        : {
            ok: false,
            error: {
              code: 'UNAVAILABLE',
              message: `FastAPI HTTP ${response.status}`,
              retryable: true,
              provider: this.provider,
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
  async quote(symbol: string): Promise<ContractResult<MarketQuote>> {
    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/market/quote/${encodeURIComponent(symbol)}`
      );
      if (!response.ok)
        return {
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: `FastAPI HTTP ${response.status}`,
            retryable: response.status >= 500,
            provider: this.provider,
          },
        };
      const q = (await response.json()) as { symbol: string; price: number; timestamp?: string };
      return {
        ok: true,
        data: {
          symbol: q.symbol,
          price: Number(q.price),
          timestamp: q.timestamp ?? new Date().toISOString(),
          source: 'fastapi',
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
