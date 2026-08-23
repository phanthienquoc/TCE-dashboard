import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { BinanceModule } from '../binance/binance.module';
import { SsiModule } from '../ssi/ssi.module';

@Module({
  imports: [SsiModule, BinanceModule],
  controllers: [PlatformController],
})
export class ApiModule {}
