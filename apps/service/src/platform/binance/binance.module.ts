import { Module } from '@nestjs/common';
import { BinanceClient } from './binance.client';

@Module({
  providers: [BinanceClient],
  exports: [BinanceClient],
})
export class BinanceModule {}
