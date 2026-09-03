import { Inject, Injectable } from '@nestjs/common';
import {
  CONTRACT_TOKENS,
  FuturesCancelOrderInput,
  FuturesEntryOrderInput,
  FuturesTpSlInput,
  PlatformCredentialPort,
} from '@tce/contracts';
import { BinanceFuturesExecutionAdapter, BinanceFuturesStateAdapter, BinanceFuturesUserDataStream } from '@tce/binance';

type BinanceEnvironment = 'production' | 'testnet';

@Injectable()
export class BinanceFuturesService {
  constructor(@Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort) {}
  private environment(value = 'production'): BinanceEnvironment {
    if (value !== 'production' && value !== 'testnet') throw new Error(`Unsupported Binance environment: ${value}`);
    return value;
  }
  private async credentialValues(userId: string, environment = 'production') {
    const selected = this.environment(environment), credentials = await this.credentials.get(userId, 'binance', selected);
    return { selected, apiKey: typeof credentials.apiKey === 'string' ? credentials.apiKey : undefined, apiSecret: typeof credentials.apiSecret === 'string' ? credentials.apiSecret : undefined };
  }
  private async adapter(userId: string, environment = 'production') { const { selected, apiKey, apiSecret } = await this.credentialValues(userId, environment); return new BinanceFuturesExecutionAdapter({ apiKey, apiSecret }, selected); }
  private async state(userId: string, environment = 'production') { const { selected, apiKey, apiSecret } = await this.credentialValues(userId, environment); return new BinanceFuturesStateAdapter({ apiKey, apiSecret }, selected); }
  async userDataStream(userId: string, environment = 'production') { const { selected, apiKey, apiSecret } = await this.credentialValues(userId, environment); return new BinanceFuturesUserDataStream({ apiKey, apiSecret }, selected); }
  async testConnection(userId: string, environment = 'production') { return (await this.adapter(userId, environment)).testConnection(); }
  async entry(userId: string, input: FuturesEntryOrderInput, environment = 'production') { return (await this.adapter(userId, environment)).placeEntry(input); }
  async takeProfit(userId: string, input: FuturesTpSlInput, environment = 'production') { return (await this.adapter(userId, environment)).placeTakeProfit(input); }
  async stopLoss(userId: string, input: FuturesTpSlInput, environment = 'production') { return (await this.adapter(userId, environment)).placeStopLoss(input); }
  async cancel(userId: string, input: FuturesCancelOrderInput, environment = 'production') { return (await this.adapter(userId, environment)).cancelOrder(input); }
  async positions(userId: string, environment = 'production', symbol?: string) { return (await this.state(userId, environment)).positions(symbol); }
  async openOrders(userId: string, environment = 'production', symbol?: string) { return (await this.state(userId, environment)).openOrders(symbol); }
  async openOrdersForSymbol(userId: string, environment = 'production', symbol: string) { return (await this.state(userId, environment)).openOrders(symbol); }
  async order(userId: string, environment = 'production', symbol: string, orderId: string) { return (await this.state(userId, environment)).order(symbol, orderId); }
}
