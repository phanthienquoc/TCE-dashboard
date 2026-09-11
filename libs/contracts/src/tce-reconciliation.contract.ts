import type { TceOrderSide, TceOrderState } from './tce-auto-trade.contract';

export type TceReconciliationErrorCode =
  'INVALID_QUERY' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_REJECTED' | 'TIMEOUT_UNKNOWN' | 'UNKNOWN';

export type TceReconciliationQuery = Readonly<{
  accountId: string;
  environment: string;
  correlationId: string;
  requestedAt: string;
  providerOrderId?: string;
  clientOrderId?: string;
}>;

export type TceReconciledOrder = Readonly<{
  localOrderId?: string;
  executionIntentId?: string;
  providerOrderId?: string;
  clientOrderId?: string;
  symbol: string;
  side: TceOrderSide;
  quantity: number;
  filledQuantity: number;
  state: TceOrderState;
  providerStatus: string;
  observedAt: string;
}>;

export type TceReconciliationError = Readonly<{
  code: TceReconciliationErrorCode;
  message: string;
  retryable: boolean;
}>;

export type TceOrderReconciliationResult = Readonly<{
  ok: boolean;
  correlationId: string;
  observedAt: string;
  orders: readonly TceReconciledOrder[];
  missingLocalOrderIds: readonly string[];
  unknownProviderOrders: readonly TceReconciledOrder[];
  error?: TceReconciliationError;
}>;

export interface TceOrderReconciliationPort {
  listOpenOrders(query: TceReconciliationQuery): Promise<TceOrderReconciliationResult>;
  getOrder(
    query: TceReconciliationQuery,
    providerOrderId: string
  ): Promise<TceOrderReconciliationResult>;
}
