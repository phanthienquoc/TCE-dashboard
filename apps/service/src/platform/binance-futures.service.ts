import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CONTRACT_TOKENS,
  FuturesCancelOrderInput,
  FuturesEntryOrderInput,
  FuturesTpSlInput,
  PlatformCredentialPort,
} from '@tce/contracts';
import {
  BinanceFuturesExecutionAdapter,
  BinanceFuturesStateAdapter,
  BinanceFuturesUserDataStream,
} from '@tce/binance';

type BinanceEnvironment = 'production' | 'testnet';

@Injectable()
export class BinanceFuturesService {
  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort
  ) {}

  private environment(value = 'production'): BinanceEnvironment {
    if (value !== 'production' && value !== 'testnet')
      throw new UnauthorizedException(`Unsupported Binance environment: ${value}`);
    return value;
  }

  private async context(userId: string, environment = 'production') {
    const selected = this.environment(environment);
    try {
      const raw = await this.credentials.get(userId, 'binance', selected);
      const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
      const apiSecret = typeof raw.apiSecret === 'string' ? raw.apiSecret.trim() : '';
      if (!apiKey || !apiSecret)
        throw new ServiceUnavailableException({
          code: 'BINANCE_CREDENTIALS_MISSING',
          message: `Binance ${selected} credentials are missing. Configure your API Key and API Secret first.`,
        });
      return Object.freeze({ environment: selected, apiKey, apiSecret });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        /credentials not configured/i.test(message) ||
        /platform credentials not configured/i.test(message)
      )
        throw new ServiceUnavailableException({
          code: 'BINANCE_CREDENTIALS_MISSING',
          message: `Binance ${selected} credentials are missing. Configure your API Key and API Secret first.`,
        });
      throw error;
    }
  }

  /**
   * Provider facade: engines consume capabilities from here instead of resolving
   * credentials and environment independently.
   */
  async execution(userId: string, environment = 'production') {
    const context = await this.context(userId, environment);
    return new BinanceFuturesExecutionAdapter(
      { apiKey: context.apiKey, apiSecret: context.apiSecret },
      context.environment
    );
  }

  async state(userId: string, environment = 'production') {
    const context = await this.context(userId, environment);
    return new BinanceFuturesStateAdapter(
      { apiKey: context.apiKey, apiSecret: context.apiSecret },
      context.environment
    );
  }

  async userDataStream(userId: string, environment = 'production') {
    const context = await this.context(userId, environment);
    return new BinanceFuturesUserDataStream(
      { apiKey: context.apiKey, apiSecret: context.apiSecret },
      context.environment
    );
  }

  async testConnection(userId: string, environment = 'production') {
    return (await this.execution(userId, environment)).testConnection();
  }

  async entry(userId: string, input: FuturesEntryOrderInput, environment = 'production') {
    return (await this.execution(userId, environment)).placeEntry(input);
  }

  async takeProfit(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.execution(userId, environment)).placeTakeProfit(input);
  }

  async stopLoss(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.execution(userId, environment)).placeStopLoss(input);
  }

  async cancel(userId: string, input: FuturesCancelOrderInput, environment = 'production') {
    return (await this.execution(userId, environment)).cancelOrder(input);
  }

  async positions(userId: string, environment = 'production', symbol?: string) {
    return (await this.state(userId, environment)).positions(symbol);
  }

  async openOrders(userId: string, environment = 'production', symbol?: string) {
    return (await this.state(userId, environment)).openOrders(symbol);
  }

  async openOrdersForSymbol(userId: string, environment = 'production', symbol: string) {
    return (await this.state(userId, environment)).openOrders(symbol);
  }

  async order(userId: string, environment = 'production', symbol: string, orderId: string) {
    return (await this.state(userId, environment)).order(symbol, orderId);
  }
}
