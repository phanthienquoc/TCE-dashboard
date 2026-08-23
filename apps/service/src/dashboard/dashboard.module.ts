import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardSourcesService } from './dashboard-sources.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardSourcesService],
  exports: [DashboardSourcesService],
})
export class DashboardModule {}
