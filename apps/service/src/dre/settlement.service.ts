import { Injectable } from '@nestjs/common';
import type { RollingPosition } from './dre.types';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import { WeekdaySettlementCalendar } from './weekday-settlement-calendar';
import { assertPositionTransition } from './rolling-position';

@Injectable()
export class SettlementService {
  private readonly calendar = new WeekdaySettlementCalendar();

  constructor(private readonly repository: DividendCampaignRepository) {}

  async markBought(positionId: string, entryAt = new Date()): Promise<RollingPosition | null> {
    const position = await this.repository.findPositionById(positionId);
    if (!position) return null;
    assertPositionTransition(position.state, 'T+2_PENDING');

    const settlementAt = this.calendar.addSettlementDays(entryAt, 2).toISOString();
    return this.repository.updatePositionLifecycle(positionId, {
      state: 'T+2_PENDING',
      entryAt: entryAt.toISOString(),
      settlementAt,
      availableAt: settlementAt,
    });
  }

  async reconcile(campaignId: string, now = new Date()): Promise<RollingPosition[]> {
    const positions = await this.repository.listPositions(campaignId);
    const eligible = positions.filter(
      position =>
        position.state === 'T+2_PENDING' &&
        Boolean(position.availableAt) &&
        new Date(position.availableAt!).getTime() <= now.getTime(),
    );

    const updated: RollingPosition[] = [];
    for (const position of eligible) {
      assertPositionTransition(position.state, 'AVAILABLE');
      const result = await this.repository.updatePositionLifecycle(position.id, { state: 'AVAILABLE' });
      if (result) updated.push(result);
    }
    return updated;
  }

  canSell(position: RollingPosition, now = new Date()): boolean {
    return (
      position.state === 'AVAILABLE' &&
      Boolean(position.availableAt) &&
      new Date(position.availableAt!).getTime() <= now.getTime()
    );
  }
}
