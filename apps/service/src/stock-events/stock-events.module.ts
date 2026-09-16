import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { StockEventsController } from './stock-events.controller';
import { StockEventsService } from './stock-events.service';
import { StockEventsSupabaseRepository } from './stock-events.supabase.repository';
import { StockDividendPoolController } from './stock-dividend-pool.controller';
import { StockDividendPoolService } from './stock-dividend-pool.service';
import { HuntingDividendScannerService } from './hunting-dividend-scanner.service';
import { DividendOhlcvService } from './dividend-ohlcv.service';
import { DividendOhlcvController } from './dividend-ohlcv.controller';

@Module({
  imports: [AuthModule, PlatformCredentialsModule],
  controllers: [StockEventsController, StockDividendPoolController, DividendOhlcvController],
  providers: [StockEventsService, StockEventsSupabaseRepository, StockDividendPoolService, HuntingDividendScannerService, DividendOhlcvService],
  exports: [StockEventsService, StockDividendPoolService, HuntingDividendScannerService, DividendOhlcvService],
})
export class StockEventsModule {}
