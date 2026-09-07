import { Injectable } from '@nestjs/common';
import type { CashPortfolioPort, DreRepositoryPort, TceCorePort } from './dre.contracts';
import type { DreAction, RollingPosition } from './dre.types';
import { RollingPositionService } from './rolling-position.service';

export type NextPositionResult =
  | { status: 'NEXT_POSITION_READY'; position: RollingPosition; action: DreAction; settledCash: number; requiredCash: number }
  | { status: 'NEXT_PENDING'; position: RollingPosition; reason: 'INSUFFICIENT_SETTLED_CASH' | 'TCE_NO_DECISION' | 'INVALID_TCE_QUANTITY' | 'INVALID_TCE_PRICE' | 'BLOCKED_BY_SEQUENCE'; settledCash: number; requiredCash: number };

@Injectable()
export class NextPositionService {
  constructor(
    private readonly positions: RollingPositionService,
    private readonly repository: DreRepositoryPort,
    private readonly cash: CashPortfolioPort,
    private readonly tceCore: TceCorePort,
  ) {}

  async prepare(input: { accountId: string; campaignId: string; symbol: string; context?: Record<string, unknown> }): Promise<NextPositionResult> {
    const next = await this.positions.getNext(input.campaignId);
    const current = await this.positions.getCurrent(input.campaignId);
    if (current && !['SOLD', 'COMPLETED', 'MISSED'].includes(current.state)) {
      const position = next ?? (await this.positions.ensureNext(input.campaignId, input.symbol));
      return { status: 'NEXT_PENDING', position, reason: 'BLOCKED_BY_SEQUENCE', settledCash: await this.cash.getSettledCash(input.accountId), requiredCash: 0 };
    }

    const position = next ?? (await this.positions.ensureNext(input.campaignId, input.symbol));
    const settledCash = await this.cash.getSettledCash(input.accountId);
    if (!Number.isFinite(settledCash) || settledCash < 0) throw new Error('Invalid settled cash');

    const decision = await this.tceCore.evaluate(position.symbol, {
      ...(input.context ?? {}),
      accountId: input.accountId,
      campaignId: input.campaignId,
      positionId: position.id,
      sequence: position.sequence,
      settledCash,
    });
    if (!decision) return { status: 'NEXT_PENDING', position, reason: 'TCE_NO_DECISION', settledCash, requiredCash: 0 };
    if (!Number.isFinite(decision.quantity) || decision.quantity <= 0) return { status: 'NEXT_PENDING', position, reason: 'INVALID_TCE_QUANTITY', settledCash, requiredCash: 0 };
    if (!Number.isFinite(decision.entryPrice) || decision.entryPrice <= 0) return { status: 'NEXT_PENDING', position, reason: 'INVALID_TCE_PRICE', settledCash, requiredCash: 0 };

    const requiredCash = decision.quantity * decision.entryPrice;
    if (requiredCash > settledCash) return { status: 'NEXT_PENDING', position, reason: 'INSUFFICIENT_SETTLED_CASH', settledCash, requiredCash };

    const hydrated = await this.repository.savePosition({ ...position, tceDecision: decision });
    void hydrated;
    const action: DreAction = {
      idempotencyKey: `${position.symbol}-${position.campaignId}-${position.sequence}-BUY`,
      campaignId: position.campaignId,
      positionId: position.id,
      type: 'BUY',
      quantity: decision.quantity,
      reason: 'TCE Core approved next position with sufficient settled cash',
    };
    const saved = await this.repository.findPositionById(position.id);
    return { status: 'NEXT_POSITION_READY', position: saved ?? { ...position, tceDecision: decision }, action, settledCash, requiredCash };
  }
}
