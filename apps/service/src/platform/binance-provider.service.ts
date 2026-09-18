import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { CONTRACT_TOKENS, PlatformCredentialPort } from '@tce/contracts';
import { BinanceFuturesExecutionAdapter, BinanceFuturesStateAdapter, BinanceFuturesUserDataStream, BinanceMarketAdapter } from '@tce/binance';
type BinanceEnvironment = 'production' | 'testnet';
type Credentials = { apiKey: string; apiSecret: string };

@Injectable()
export class BinanceProviderService {
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort) {}

  private environment(value = 'production'): BinanceEnvironment {
    if (value !== 'production' && value !== 'testnet')
      throw new UnauthorizedException(`Unsupported Binance environment: ${value}`);
    return value;
  }

  private async resolve(userId: string, environment = 'production'): Promise<{ environment: BinanceEnvironment; credentials: Credentials }> {
    const selected = this.environment(environment);
    const raw = await this.credentials.get(userId, 'binance', selected);
    const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
    const apiSecret = typeof raw.apiSecret === 'string' ? raw.apiSecret.trim() : '';
    if (!apiKey || !apiSecret)
      throw new ServiceUnavailableException({
        code: 'BINANCE_CREDENTIALS_MISSING',
        message: `Binance ${selected} credentials are missing.`,
      });
    return { environment: selected, credentials: { apiKey, apiSecret } };
  }

  async market() {
    return new BinanceMarketAdapter();
  }

  async execution(userId: string, environment = 'production') {
    const context = await this.resolve(userId, environment);
    return new BinanceFuturesExecutionAdapter(context.credentials, context.environment);
  }

  async state(userId: string, environment = 'production') {
    const context = await this.resolve(userId, environment);
    return new BinanceFuturesStateAdapter(context.credentials, context.environment);
  }

  async userDataStream(userId: string, environment = 'production') {
    const context = await this.resolve(userId, environment);
    return new BinanceFuturesUserDataStream(context.credentials, context.environment);
  }

  async credentialsContext(userId: string, environment = 'production') {
    return this.resolve(userId, environment);
  }
}
