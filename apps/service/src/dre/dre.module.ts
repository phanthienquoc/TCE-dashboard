import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { DividendCampaignService } from './dividend-campaign.service';

@Module({
  imports: [DbModule],
  providers: [DividendCampaignRepository, DividendCampaignService],
  exports: [DividendCampaignRepository, DividendCampaignService],
})
export class DreModule {}
