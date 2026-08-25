import { Inject, Injectable } from '@nestjs/common';
import { CONTRACT_TOKENS, FuturesEntryOrderInput, FuturesTpSlInput, PlatformCredentialPort } from '@tce/contracts';
import { BinanceFuturesExecutionAdapter } from '@tce/binance';

@Injectable()
export class BinanceFuturesService {
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort) {}

  private async adapter(userId: string, environment = 'production') {
    const credentials = await this.credentials.get(userId, 'binance', environment);
    return new BinanceFuturesExecutionAdapter({
      apiKey: typeof credentials.apiKey === 'string' ? credentials.apiKey : undefined,
      apiSecret: typeof credentials.apiSecret === 'string' ? credentials.apiSecret : undefined,
      baseUrl: typeof credentials.baseUrl === 'string' ? credentials.baseUrl : undefined,
    });
  }

  async testConnection(userId: string, environment = 'production') {
    return (await this.adapter(userId, environment)).testConnection();
  }

  async entry(userId: string, input: FuturesEntryOrderInput, environment = 'production') {
    return (await this.adapter(userId, environment)).placeEntry(input);
  }

  async takeProfit(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.adapter(userId, environment)).placeTakeProfit(input);
  }

  async stopLoss(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.adapter(userId, environment)).placeStopLoss(input);
  }
}
