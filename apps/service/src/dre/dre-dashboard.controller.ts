import { Controller, Get, Param } from '@nestjs/common';
import { DividendCampaignRepository } from './dividend-campaign.repository';

@Controller('dre/dashboard')
export class DreDashboardController {
  constructor(private readonly repository: DividendCampaignRepository) {}

  @Get('campaigns')
  async campaigns() {
    const campaigns = await this.repository.listCampaigns();
    return Promise.all(campaigns.map(async campaign => {
      const positions = await this.repository.listPositions(campaign.id);
      const current = positions.filter(p => !['PLANNED', 'NEXT'].includes(p.state)).sort((a, b) => b.sequence - a.sequence)[0] ?? null;
      const next = positions.find(p => p.state === 'NEXT') ?? null;
      const completed = positions.filter(p => p.state === 'COMPLETED' || p.state === 'SOLD').length;
      const gaps = positions.filter(p => p.state === 'MISSED').length;
      return {
        campaign,
        current,
        next,
        positions,
        continuity: { completed, gaps, total: positions.length },
      };
    }));
  }

  @Get('campaigns/:campaignId')
  async campaign(@Param('campaignId') campaignId: string) {
    const campaign = (await this.repository.listCampaigns()).find(item => item.id === campaignId);
    if (!campaign) return { campaign: null, positions: [] };
    const positions = await this.repository.listPositions(campaign.id);
    return { campaign, positions };
  }
}
