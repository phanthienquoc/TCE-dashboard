import { Injectable, Logger } from '@nestjs/common';
import type { TceExecutionIntent } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';
import { TceExecutionOrchestrator } from '@tce/tce';

const READY_AUTO_SELL_PREFIX = 'TCE_AUTO_SELL:';

@Injectable()
export class ProfitExitExecutionService {
  private readonly logger = new Logger(ProfitExitExecutionService.name);

  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly execution: TceExecutionOrchestrator
  ) {}

  async executeReady(accountId: string) {
    const { data: orders, error } = await this.supabase.db
      .from('tce_orders')
      .select('id,account_id,symbol,side,price,quantity,status,note')
      .eq('account_id', accountId)
      .eq('side', 'SELL')
      .eq('status', 'READY')
      .like('note', `${READY_AUTO_SELL_PREFIX}%`)
      .order('id');
    if (error) throw error;

    let submitted = 0;
    const results: Array<{
      orderId: string;
      symbol: string;
      status: string;
      providerOrderId?: string;
      error?: string;
    }> = [];

    for (const order of orders ?? []) {
      const startedAt = new Date().toISOString();
      const orderId = String(order.id);
      const symbol = String(order.symbol).trim().toUpperCase();
      const quantity = Math.trunc(Number(order.quantity));
      const price = Number(order.price);
      const correlationId = `tce-auto-sell:${orderId}`;
      const idempotencyKey = `tce-auto-sell:${orderId}`;
      const clientRequestId = `TCE-AUTO-SELL-${orderId}`;

      if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
        await this.markRejected(orderId, 'Invalid auto-sell order payload');
        results.push({
          orderId,
          symbol,
          status: 'REJECTED',
          error: 'Invalid auto-sell order payload',
        });
        continue;
      }

      const intent: TceExecutionIntent = {
        id: `execution-intent:auto-sell:${orderId}`,
        orderPlanId: `auto-sell:${orderId}`,
        correlationId,
        idempotencyKey,
        mode: 'LIVE',
        symbol,
        side: 'SELL',
        quantity,
        limitPrice: price,
        lifecycleState: 'EXIT_READY',
        createdAt: startedAt,
      };

      try {
        const { result } = await this.execution.execute({
          operation: 'SUBMIT',
          accountId,
          environment: 'production',
          mode: 'LIVE',
          authorization: {
            approvalId: `auto-profit-exit:${orderId}`,
            approvedAt: startedAt,
            correlationId,
            idempotencyKey,
          },
          intent,
          clientRequestId,
        });

        if (result.ok) {
          submitted += 1;
          const status = result.status === 'PENDING' ? 'PENDING' : 'SUBMITTED';
          const { error: updateError } = await this.supabase.db
            .from('tce_orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId);
          if (updateError)
            this.logger.warn(`Unable to update auto-sell order ${orderId}: ${updateError.message}`);
          results.push({ orderId, symbol, status, providerOrderId: result.providerOrderId });
          continue;
        }

        if (result.error?.retryable && !result.error.reconciliationRequired) {
          this.logger.warn(
            `Auto-sell order ${orderId} was not dispatched because a required dependency is unavailable; it remains READY for a later retry`
          );
          results.push({
            orderId,
            symbol,
            status: 'RETRYABLE',
            error: result.error.message,
          });
          continue;
        }

        const status =
          result.status === 'UNKNOWN' || result.error?.reconciliationRequired
            ? 'UNKNOWN'
            : 'REJECTED';
        const { error: updateError } = await this.supabase.db
          .from('tce_orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (updateError)
          this.logger.warn(`Unable to update auto-sell order ${orderId}: ${updateError.message}`);
        results.push({ orderId, symbol, status, error: result.error?.message });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Auto-sell execution failed for order ${orderId}: ${message}`);
        await this.markUnknown(orderId, message);
        results.push({ orderId, symbol, status: 'UNKNOWN', error: message });
      }
    }

    return { submitted, evaluated: orders?.length ?? 0, results };
  }

  private async markUnknown(orderId: string, message: string) {
    const { error } = await this.supabase.db
      .from('tce_orders')
      .update({
        status: 'UNKNOWN',
        updated_at: new Date().toISOString(),
        note: `${READY_AUTO_SELL_PREFIX}UNKNOWN:${message}`,
      })
      .eq('id', orderId);
    if (error)
      this.logger.warn(`Unable to mark auto-sell order ${orderId} unknown: ${error.message}`);
  }

  private async markRejected(orderId: string, message: string) {
    const { error } = await this.supabase.db
      .from('tce_orders')
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString(),
        note: `${READY_AUTO_SELL_PREFIX}REJECTED:${message}`,
      })
      .eq('id', orderId);
    if (error)
      this.logger.warn(`Unable to mark auto-sell order ${orderId} rejected: ${error.message}`);
  }
}
