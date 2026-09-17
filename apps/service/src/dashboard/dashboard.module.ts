import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { StockEventsModule } from '../stock-events/stock-events.module';
import { DashboardController } from './dashboard.controller';
import { DashboardPriceHistoryController } from './dashboard-price-history.controller';
import { PoolPromotionController } from './pool-promotion.controller';
import { NextPositionController } from './next-position.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSourcesService } from './dashboard-sources.service';
import { EngineRuntimeService } from './engine-runtime.service';

@Module({
  imports: [AuthModule, PlatformCredentialsModule, StockEventsModule],
  controllers: [DashboardController, DashboardPriceHistoryController, PoolPromotionController, NextPositionController],
  providers: [DashboardService, DashboardSourcesService, EngineRuntimeService],
  exports: [DashboardSourcesService, EngineRuntimeService],
})
export class DashboardModule {}
