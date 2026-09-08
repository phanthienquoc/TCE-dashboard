import { Injectable } from '@nestjs/common';
import type { DrePositionState, RollingPosition } from './dre.types';
import { DividendCampaignRepository } from './dividend-campaign.repository';
import {
  assertPositionTransition,
  getCurrentPosition,
  getNextPosition,
  nextSequence,
  positionId,
  TERMINAL_POSITION_STATES,
} from './rolling-position';

@Injectable()
export class RollingPositionService {
  constructor(private readonly repository: DividendCampaignRepository) {}

  async list(campaignId: string): Promise<RollingPosition[]> {
    return this.repository.listPositions(campaignId);
  }

  async getCurrent(campaignId: string): Promise<RollingPosition | null> {
    return getCurrentPosition(await this.list(campaignId));
  }

  async getNext(campaignId: string): Promise<RollingPosition | null> {
    return getNextPosition(await this.list(campaignId));
  }

  async ensureNext(campaignId: string, symbol: string): Promise<RollingPosition> {
    await this.repository.ensureIndexes();
    const positions = await this.list(campaignId);
    const existingNext = getNextPosition(positions);
    if (existingNext) return existingNext;

    const planned = positions
      .filter(position => position.state === 'PLANNED')
      .sort((a, b) => a.sequence - b.sequence)[0];
    if (planned) {
      assertPositionTransition(planned.state, 'NEXT');
      return (await this.repository.updatePositionState(planned.id, 'NEXT'))!;
    }

    const sequence = nextSequence(positions);
    const position: RollingPosition = {
      id: positionId(campaignId, sequence),
      campaignId,
      sequence,
      symbol: symbol.trim().toUpperCase(),
      state: 'NEXT',
    };
    await this.repository.savePosition(position);
    return position;
  }

  async transition(id: string, to: DrePositionState): Promise<RollingPosition | null> {
    const position = await this.repository.findPositionById(id);
    if (!position) return null;
    assertPositionTransition(position.state, to);
    return this.repository.updatePositionState(id, to);
  }

  async completeCurrent(
    campaignId: string
  ): Promise<{ completed: RollingPosition; next: RollingPosition | null }> {
    const current = await this.getCurrent(campaignId);
    if (!current) throw new Error(`No current DRE position for campaign ${campaignId}`);
    assertPositionTransition(current.state, 'COMPLETED');
    const completed = (await this.repository.updatePositionState(current.id, 'COMPLETED'))!;
    const next = getNextPosition(await this.list(campaignId));
    return { completed, next };
  }

  async markMissed(id: string): Promise<RollingPosition | null> {
    const position = await this.repository.findPositionById(id);
    if (!position) return null;
    if (TERMINAL_POSITION_STATES.has(position.state)) return position;
    assertPositionTransition(position.state, 'MISSED');
    return this.repository.updatePositionState(id, 'MISSED');
  }
}
