import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CapitalRecyclingRepository } from './capital-recycling.repository';
import { CapitalRecyclingService } from './capital-recycling.service';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DividendCampaignService } from './dividend-campaign.service';
import { RollingPositionService } from './rolling-position.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [DbModule],
  providers: [
    DividendCampaignRepository,
    DividendCampaignService,
    RollingPositionService,
    SettlementService,
    CapitalRecyclingRepository,
    CapitalRecyclingService,
  ],
  exports: [
    DividendCampaignRepository,
    DividendCampaignService,
    RollingPositionService,
    SettlementService,
    CapitalRecyclingService,
  ],
})
export class DreModule {}
