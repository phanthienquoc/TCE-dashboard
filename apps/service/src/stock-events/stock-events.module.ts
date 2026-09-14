import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StockEventsController } from './stock-events.controller';
import { StockEventsService } from './stock-events.service';
import { StockEventsSupabaseRepository } from './stock-events.supabase.repository';
import { StockDividendPoolController } from './stock-dividend-pool.controller';
import { StockDividendPoolService } from './stock-dividend-pool.service';
import { HuntingDividendScannerService } from './hunting-dividend-scanner.service';

@Module({
  imports: [AuthModule],
  controllers: [StockEventsController, StockDividendPoolController],
  providers: [StockEventsService, StockEventsSupabaseRepository, StockDividendPoolService, HuntingDividendScannerService],
  exports: [StockEventsService, StockDividendPoolService, HuntingDividendScannerService],
})
export class StockEventsModule {}
