import { Module } from '@nestjs/common';
import { ApiModule } from './api/api.module';
import { BinanceModule } from './binance/binance.module';
import { SsiModule } from './ssi/ssi.module';

@Module({
  imports: [ApiModule, SsiModule, BinanceModule],
  exports: [SsiModule, BinanceModule],
})
export class PlatformModule {}
