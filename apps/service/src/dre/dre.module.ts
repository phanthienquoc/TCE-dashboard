import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CapitalRecyclingRepository } from './capital-recycling.repository';
import { CapitalRecyclingService } from './capital-recycling.service';
import { DreDashboardController } from './dre-dashboard.controller';
import { DreHealthController } from './dre-health.controller';
import { DreProductionService } from './dre-production.service';
import { DreExecutionRepository } from './execution.repository';
import { SafeOrderExecutionService } from './safe-order-execution.service';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DividendCampaignService } from './dividend-campaign.service';
import { RollingPositionService } from './rolling-position.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [DbModule],
  controllers: [DreDashboardController, DreHealthController],
  providers: [DividendCampaignRepository, DividendCampaignService, RollingPositionService, SettlementService, CapitalRecyclingRepository, CapitalRecyclingService, DreExecutionRepository, SafeOrderExecutionService, DreProductionService],
  exports: [DividendCampaignRepository, DividendCampaignService, RollingPositionService, SettlementService, CapitalRecyclingService, DreExecutionRepository, SafeOrderExecutionService, DreProductionService],
})
export class DreModule {}
