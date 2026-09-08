import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformCredentialsModule } from '../platform/platform-credentials.module';
import { DashboardController } from './dashboard.controller';
import { PoolPromotionController } from './pool-promotion.controller';
import { NextPositionController } from './next-position.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSourcesService } from './dashboard-sources.service';

@Module({
  imports: [AuthModule, PlatformCredentialsModule],
  controllers: [DashboardController, PoolPromotionController, NextPositionController],
  providers: [DashboardService, DashboardSourcesService],
  exports: [DashboardSourcesService],
})
export class DashboardModule {}
