import { Injectable } from '@nestjs/common';
import { BinanceProviderService } from './binance-provider.service';

@Injectable()
export class BinanceDerivativesEngine {
  constructor(private readonly provider: BinanceProviderService) {}

  async positions(userId: string, environment = 'production', symbol?: string) {
    return (await this.provider.state(userId, environment)).positions(symbol);
  }

  async openOrders(userId: string, environment = 'production', symbol?: string) {
    return (await this.provider.state(userId, environment)).openOrders(symbol);
  }

  async order(userId: string, environment: string, symbol: string, orderId: string) {
    return (await this.provider.state(userId, environment)).order(symbol, orderId);
  }

  async userDataStream(userId: string, environment = 'production') {
    return this.provider.userDataStream(userId, environment);
  }
}
