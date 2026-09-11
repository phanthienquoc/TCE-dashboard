import { Injectable } from '@nestjs/common';
import type {
  AccountOrder,
  TceOrderReconciliationPort,
  TceOrderReconciliationResult,
  TceReconciledOrder,
  TceReconciliationQuery,
} from '@tce/contracts';
import { mapProviderOrderStatus } from '@tce/tce';
import { SsiApplicationService } from './ssi.application.service';
import { SupabaseClientService } from '../db/supabase.client';
import { TceSsiTradingAuthorizationAdapter } from './tce-ssi-trading-authorization.adapter';

const nowIso = () => new Date().toISOString();

const errorResult = (
  query: TceReconciliationQuery,
  code: 'INVALID_QUERY' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_REJECTED' | 'TIMEOUT_UNKNOWN',
  message: string,
  retryable = false
): TceOrderReconciliationResult => ({
  ok: false,
  correlationId: query.correlationId,
  observedAt: nowIso(),
  orders: [],
  missingLocalOrderIds: [],
  unknownProviderOrders: [],
  error: { code, message, retryable },
});

@Injectable()
export class TceSsiOrderReconciliationAdapter implements TceOrderReconciliationPort {
  constructor(
    private readonly ssi: SsiApplicationService,
    private readonly supabase: SupabaseClientService,
    private readonly authorization: TceSsiTradingAuthorizationAdapter
  ) {}

  async listOpenOrders(query: TceReconciliationQuery): Promise<TceOrderReconciliationResult> {
    const validation = this.validateQuery(query);
    if (validation) return validation;

    const account = await this.resolveAccount(query);
    if (!account.ok) return account.result;

    const auth = await this.authorization.ensureAuthorized({
      accountId: query.accountId,
      environment: query.environment,
      correlationId: query.correlationId,
      idempotencyKey: `reconcile:${query.correlationId}`,
      mode: 'LIVE',
    });
    if (!auth.ok)
      return errorResult(query, 'PROVIDER_UNAVAILABLE', auth.error.message, auth.error.retryable);
    if (auth.data.state !== 'READY')
      return errorResult(
        query,
        'PROVIDER_UNAVAILABLE',
        `SSI authorization is ${auth.data.state}`,
        true
      );
    if (auth.data.accountId !== query.accountId || auth.data.environment !== query.environment)
      return errorResult(
        query,
        'INVALID_QUERY',
        'SSI authorization identity does not match reconciliation account/environment'
      );

    const result = await this.ssi.current(account.userId, query.environment, {});
    if (!result.ok) {
      const lower = result.error.message.toLowerCase();
      const code =
        lower.includes('timeout') || lower.includes('timed out')
          ? 'TIMEOUT_UNKNOWN'
          : 'PROVIDER_REJECTED';
      return errorResult(
        query,
        code,
        result.error.message,
        code === 'TIMEOUT_UNKNOWN' || result.error.retryable
      );
    }

    const orders = result.data.orders.map(order => this.toReconciledOrder(order, query));
    const unknownProviderOrders = orders.filter(order => order.state === 'UNKNOWN');
    const openOrders = orders.filter(
      order =>
        order.state === 'SUBMITTED' ||
        order.state === 'PARTIALLY_FILLED' ||
        order.state === 'CANCEL_PENDING'
    );

    return {
      ok: true,
      correlationId: query.correlationId,
      observedAt: nowIso(),
      orders: openOrders,
      missingLocalOrderIds: [],
      unknownProviderOrders,
    };
  }

  async getOrder(
    query: TceReconciliationQuery,
    providerOrderId: string
  ): Promise<TceOrderReconciliationResult> {
    const normalizedProviderOrderId = String(providerOrderId ?? '').trim();
    if (!normalizedProviderOrderId)
      return errorResult(query, 'INVALID_QUERY', 'providerOrderId is required');

    const result = await this.listOpenOrders(query);
    if (!result.ok) return result;

    const order =
      result.orders.find(item => item.providerOrderId === normalizedProviderOrderId) ??
      result.unknownProviderOrders.find(item => item.providerOrderId === normalizedProviderOrderId);
    return {
      ...result,
      orders: order && order.state !== 'UNKNOWN' ? [order] : [],
      unknownProviderOrders: order?.state === 'UNKNOWN' ? [order] : [],
    };
  }

  private validateQuery(query: TceReconciliationQuery) {
    if (
      !query.accountId.trim() ||
      !query.environment.trim() ||
      !query.correlationId.trim() ||
      !query.requestedAt.trim()
    )
      return errorResult(
        query,
        'INVALID_QUERY',
        'accountId, environment, correlationId and requestedAt are required'
      );
    if (Number.isNaN(Date.parse(query.requestedAt)))
      return errorResult(query, 'INVALID_QUERY', 'requestedAt must be a valid ISO timestamp');
    return undefined;
  }

  private async resolveAccount(query: TceReconciliationQuery) {
    const { data, error } = await this.supabase.db
      .from('tce_accounts')
      .select('id,user_id')
      .eq('id', query.accountId)
      .maybeSingle();
    if (error)
      return {
        ok: false as const,
        result: errorResult(
          query,
          'PROVIDER_UNAVAILABLE',
          `Unable to resolve TCE account: ${error.message}`,
          true
        ),
      };
    if (!data?.user_id)
      return {
        ok: false as const,
        result: errorResult(query, 'INVALID_QUERY', 'TCE account is not configured'),
      };
    return { ok: true as const, userId: String(data.user_id) };
  }

  private toReconciledOrder(
    order: AccountOrder,
    query: TceReconciliationQuery
  ): TceReconciledOrder {
    const state = mapProviderOrderStatus(order.status);
    return {
      providerOrderId: order.externalId,
      clientOrderId: order.clientRequestId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      state,
      providerStatus: order.status,
      observedAt: order.modifyTime ?? order.createdAt ?? query.requestedAt,
    };
  }
}
