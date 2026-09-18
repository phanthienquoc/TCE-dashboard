import { Injectable } from '@nestjs/common';
import { BinanceProviderService } from './binance-provider.service';

@Injectable()
export class BinanceMarketEngine {
  constructor(private readonly provider: BinanceProviderService) {}

  async quote(symbol: string) {
    return (await this.provider.market()).quote(symbol);
  }

  async health(userId: string, environment = 'production') {
    return (await this.provider.market()).health({ userId, environment });
  }
}
