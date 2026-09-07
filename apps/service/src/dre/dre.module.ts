import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DividendCampaignService } from './dividend-campaign.service';
import { RollingPositionService } from './rolling-position.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [DbModule],
  providers: [DividendCampaignRepository, DividendCampaignService, RollingPositionService, SettlementService],
  exports: [DividendCampaignRepository, DividendCampaignService, RollingPositionService, SettlementService],
})
export class DreModule {}
