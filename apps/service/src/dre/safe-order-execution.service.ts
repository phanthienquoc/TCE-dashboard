import { Injectable } from '@nestjs/common';
import type { DreAction, DreActionType } from './dre.types';
import type { DreExecutionPort } from './dre.contracts';
import { DreExecutionRepository, type DreOrderStatus } from './execution.repository';

export interface BrokerStatePort {
  getOrder(externalId: string): Promise<{ status: DreOrderStatus; filledQuantity?: number } | null>;
}

@Injectable()
export class SafeOrderExecutionService {
  constructor(private readonly repository: DreExecutionRepository) {}

  async submit(
    action: DreAction,
    runId: string,
    mode: 'DRY_RUN' | 'LIVE',
    executor?: DreExecutionPort
  ): Promise<{ status: DreOrderStatus; externalId?: string }> {
    await this.repository.ensureIndexes();
    const existing = await this.repository.getAction(action.idempotencyKey);
    if (existing) {
      if (
        existing.status === 'UNKNOWN' ||
        existing.status === 'SUBMITTED' ||
        existing.status === 'PARTIAL'
      )
        return { status: existing.status, externalId: existing.externalId };
      if (existing.status === 'FILLED')
        return { status: 'FILLED', externalId: existing.externalId };
    }
    if (mode === 'DRY_RUN') {
      await this.repository.saveAction({ ...action, runId, status: 'PENDING' });
      return { status: 'PENDING' };
    }
    if (!executor) throw new Error('Live execution adapter is required explicitly');
    const pending = { ...action, runId, status: 'PENDING' as const };
    await this.repository.saveAction(pending);
    try {
      const response = await executor.execute(action);
      const status: DreOrderStatus = response.accepted ? 'SUBMITTED' : 'FAILED';
      await this.repository.saveAction({
        ...pending,
        status,
        externalId: response.externalId,
        submittedAt: new Date().toISOString(),
      });
      return { status, externalId: response.externalId };
    } catch (error) {
      await this.repository.saveAction({
        ...pending,
        status: 'UNKNOWN',
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'UNKNOWN' };
    }
  }

  async reconcile(externalId: string, broker: BrokerStatePort): Promise<DreOrderStatus> {
    const state = await broker.getOrder(externalId);
    if (!state) return 'UNKNOWN';
    const record = (await this.repository.listPending()).find(
      item => item.externalId === externalId
    );
    if (record)
      await this.repository.saveAction({
        ...record,
        status: state.status,
        filledQuantity: state.filledQuantity,
      });
    return state.status;
  }
}

export const isSupportedActionType = (type: DreActionType): boolean =>
  type === 'BUY' || type === 'SELL';
