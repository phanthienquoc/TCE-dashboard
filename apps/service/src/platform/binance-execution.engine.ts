import { Injectable } from '@nestjs/common';
import { FuturesCancelOrderInput, FuturesEntryOrderInput, FuturesTpSlInput } from '@tce/contracts';
import { BinanceProviderService } from './binance-provider.service';

@Injectable()
export class BinanceExecutionEngine {
  constructor(private readonly provider: BinanceProviderService) {}

  async testConnection(userId: string, environment = 'production') {
    return (await this.provider.execution(userId, environment)).testConnection();
  }

  async entry(userId: string, input: FuturesEntryOrderInput, environment = 'production') {
    return (await this.provider.execution(userId, environment)).placeEntry(input);
  }

  async takeProfit(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.provider.execution(userId, environment)).placeTakeProfit(input);
  }

  async stopLoss(userId: string, input: FuturesTpSlInput, environment = 'production') {
    return (await this.provider.execution(userId, environment)).placeStopLoss(input);
  }

  async cancel(userId: string, input: FuturesCancelOrderInput, environment = 'production') {
    return (await this.provider.execution(userId, environment)).cancelOrder(input);
  }
}
