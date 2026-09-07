import { Injectable } from '@nestjs/common';
import type { TceCorePort, DreRepositoryPort } from './dre.contracts';
import type { DreAction, RollingPosition } from './dre.types';

export type TakeProfitDecision =
  | { eligible: true; position: RollingPosition; profitPercent: number; realizedPnl: number; recycledCapital: number; action: DreAction }
  | { eligible: false; reason: 'NOT_AVAILABLE' | 'TCE_NO_DECISION' | 'TP_NOT_REACHED' | 'INVALID_PRICE' };

@Injectable()
export class TakeProfitService {
  constructor(
    private readonly repository: DreRepositoryPort,
    private readonly tceCore: TceCorePort,
  ) {}

  async evaluateCurrent(position: RollingPosition, marketPrice: number): Promise<TakeProfitDecision> {
    if (position.state !== 'AVAILABLE') return { eligible: false, reason: 'NOT_AVAILABLE' };
    if (!Number.isFinite(marketPrice) || marketPrice <= 0) return { eligible: false, reason: 'INVALID_PRICE' };

    const decision = await this.tceCore.evaluate(position.symbol, {
      campaignId: position.campaignId,
      positionId: position.id,
      sequence: position.sequence,
      entryAt: position.entryAt,
      marketPrice,
    });
    if (!decision) return { eligible: false, reason: 'TCE_NO_DECISION' };
    if (!Number.isFinite(decision.takeProfitPrice) || decision.takeProfitPrice <= 0) return { eligible: false, reason: 'INVALID_PRICE' };

    const entryPrice = position.tceDecision?.entryPrice ?? decision.entryPrice;
    const quantity = position.tceDecision?.quantity ?? decision.quantity;
    if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) return { eligible: false, reason: 'INVALID_PRICE' };

    const profitPercent = ((marketPrice - entryPrice) / entryPrice) * 100;
    if (marketPrice < decision.takeProfitPrice) return { eligible: false, reason: 'TP_NOT_REACHED' };

    const realizedPnl = (marketPrice - entryPrice) * quantity;
    return {
      eligible: true,
      position,
      profitPercent,
      realizedPnl,
      recycledCapital: marketPrice * quantity,
      action: {
        idempotencyKey: `${position.symbol}-${position.campaignId}-${position.sequence}-SELL`,
        campaignId: position.campaignId,
        positionId: position.id,
        type: 'SELL',
        quantity,
        reason: `TCE take-profit reached at ${profitPercent.toFixed(2)}%`,
      },
    };
  }

  async approveSellAction(positionId: string, marketPrice: number): Promise<TakeProfitDecision> {
    const position = await this.repository.findPositionById(positionId);
    if (!position) return { eligible: false, reason: 'TCE_NO_DECISION' };
    const result = await this.evaluateCurrent(position, marketPrice);
    if (!result.eligible) return result;
    const updated = await this.repository.updatePositionState(position.id, 'TP_REACHED');
    if (!updated) return { eligible: false, reason: 'TCE_NO_DECISION' };
    const approved = await this.repository.updatePositionState(position.id, 'SELL_APPROVED');
    if (!approved) return { eligible: false, reason: 'TCE_NO_DECISION' };
    return { ...result, position: approved };
  }

  async recordConfirmedSale(positionId: string, salePrice: number, confirmedAt = new Date().toISOString()): Promise<TakeProfitDecision> {
    const position = await this.repository.findPositionById(positionId);
    if (!position || !position.tceDecision) return { eligible: false, reason: 'TCE_NO_DECISION' };
    if (!['SELL_APPROVED', 'SELL_PENDING'].includes(position.state)) return { eligible: false, reason: 'NOT_AVAILABLE' };
    const quantity = position.tceDecision.quantity;
    const entryPrice = position.tceDecision.entryPrice;
    if (!Number.isFinite(salePrice) || salePrice <= 0 || quantity <= 0 || entryPrice <= 0) return { eligible: false, reason: 'INVALID_PRICE' };
    const realizedPnl = (salePrice - entryPrice) * quantity;
    const recycledCapital = salePrice * quantity;
    const updated = await this.repository.updatePositionLifecycle(position.id, {
      state: 'SOLD',
      soldAt: confirmedAt,
      realizedPnl,
      recycledCapital,
    });
    if (!updated) return { eligible: false, reason: 'TCE_NO_DECISION' };
    return {
      eligible: true,
      position: updated,
      profitPercent: ((salePrice - entryPrice) / entryPrice) * 100,
      realizedPnl,
      recycledCapital,
      action: {
        idempotencyKey: `${position.symbol}-${position.campaignId}-${position.sequence}-SELL`,
        campaignId: position.campaignId,
        positionId: position.id,
        type: 'SELL',
        quantity,
        reason: 'confirmed sale',
      },
    };
  }
}
