import { Injectable } from '@nestjs/common';
import type { DreAction, RollingPosition } from './dre.types';
import { RollingPositionService } from './rolling-position.service';
import { SettlementService } from './settlement.service';
import { TakeProfitService } from './take-profit.service';
import { NextPositionService, type NextPositionResult } from './next-position.service';

export interface DreDailyRun {
  runId: string;
  accountId: string;
  campaignId: string;
  mode: 'DRY_RUN' | 'LIVE';
  observedAt: string;
  current: RollingPosition | null;
  next: RollingPosition | null;
  reconciled: RollingPosition[];
  actions: DreAction[];
  nextPosition: NextPositionResult | null;
  status: 'PLANNED' | 'BLOCKED' | 'READY';
}

/** Orchestration only: strategy decisions remain owned by DRE/TCE Core. */
@Injectable()
export class DreDailyAgentService {
  constructor(
    private readonly positions: RollingPositionService,
    private readonly settlement: SettlementService,
    private readonly takeProfit: TakeProfitService,
    private readonly nextPosition: NextPositionService,
  ) {}

  async plan(input: {
    accountId: string;
    campaignId: string;
    symbol: string;
    marketPrice: number;
    mode?: 'DRY_RUN' | 'LIVE';
    context?: Record<string, unknown>;
  }): Promise<DreDailyRun> {
    const mode = input.mode ?? 'DRY_RUN';
    const observedAt = new Date().toISOString();
    const runId = `DRE-${input.campaignId}-${observedAt}`;
    const reconciled = await this.settlement.reconcile(input.campaignId);
    const current = await this.positions.getCurrent(input.campaignId);
    const next = await this.positions.getNext(input.campaignId);
    const actions: DreAction[] = [];

    if (current && current.state === 'AVAILABLE') {
      const tp = await this.takeProfit.evaluateCurrent(current, input.marketPrice);
      if (tp.eligible) actions.push(tp.action);
    }

    const nextResult = await this.nextPosition.prepare({
      accountId: input.accountId,
      campaignId: input.campaignId,
      symbol: input.symbol,
      context: input.context,
    });
    if (nextResult.status === 'NEXT_POSITION_READY') actions.push(nextResult.action);

    return {
      runId,
      accountId: input.accountId,
      campaignId: input.campaignId,
      mode,
      observedAt,
      current,
      next,
      reconciled,
      actions: actions.filter((action, index, all) => all.findIndex(item => item.idempotencyKey === action.idempotencyKey) === index),
      nextPosition: nextResult,
      status: actions.length ? 'READY' : nextResult.status === 'NEXT_PENDING' ? 'BLOCKED' : 'PLANNED',
    };
  }
}
