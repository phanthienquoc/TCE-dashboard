import { mapProviderOrderStatus } from './order-status';

export type ReconciliationOrder = {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  status: string;
  providerOrderId?: string;
  clientRequestId?: string;
};

export type ProviderReconciliationOrder = {
  providerOrderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  status: string;
  clientRequestId?: string;
};

export type ReconciliationDisposition =
  | 'CONVERGED'
  | 'PARTIAL_FILL'
  | 'TERMINAL'
  | 'MISSING_PROVIDER_ORDER'
  | 'ORPHAN_PROVIDER_ORDER'
  | 'RECONCILIATION_REQUIRED';

export type ReconciliationDelta = {
  localOrderId?: string;
  providerOrderId?: string;
  disposition: ReconciliationDisposition;
  localStatus?: string;
  providerStatus?: string;
  normalizedProviderState?: ReturnType<typeof mapProviderOrderStatus>;
  localFilledQuantity?: number;
  providerFilledQuantity?: number;
  reason: string;
};

const TERMINAL = new Set(['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED']);

function identityMatches(
  local: ReconciliationOrder,
  provider: ProviderReconciliationOrder
): boolean {
  return (
    local.providerOrderId === provider.providerOrderId ||
    (!!local.clientRequestId &&
      !!provider.clientRequestId &&
      local.clientRequestId === provider.clientRequestId)
  );
}

export function reconcileOrderStates(
  localOrders: readonly ReconciliationOrder[],
  providerOrders: readonly ProviderReconciliationOrder[]
): ReconciliationDelta[] {
  const matchedProviderIds = new Set<string>();
  const deltas: ReconciliationDelta[] = [];

  for (const local of localOrders) {
    const provider = providerOrders.find(candidate => identityMatches(local, candidate));
    if (!provider) {
      deltas.push({
        localOrderId: local.id,
        disposition: 'MISSING_PROVIDER_ORDER',
        localStatus: local.status,
        localFilledQuantity: local.filledQuantity,
        reason: 'Local order has no matching provider order.',
      });
      continue;
    }

    matchedProviderIds.add(provider.providerOrderId);
    const normalizedProviderState = mapProviderOrderStatus(provider.status);
    if (normalizedProviderState === 'UNKNOWN') {
      deltas.push({
        localOrderId: local.id,
        providerOrderId: provider.providerOrderId,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider.status,
        normalizedProviderState,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider.filledQuantity,
        reason: 'Provider status is unknown; no local state mutation is safe.',
      });
      continue;
    }

    const providerTerminal = TERMINAL.has(normalizedProviderState);
    const filledChanged = provider.filledQuantity !== local.filledQuantity;
    deltas.push({
      localOrderId: local.id,
      providerOrderId: provider.providerOrderId,
      disposition: providerTerminal ? 'TERMINAL' : filledChanged ? 'PARTIAL_FILL' : 'CONVERGED',
      localStatus: local.status,
      providerStatus: provider.status,
      normalizedProviderState,
      localFilledQuantity: local.filledQuantity,
      providerFilledQuantity: provider.filledQuantity,
      reason: providerTerminal
        ? 'Provider reports a recognized terminal state.'
        : filledChanged
          ? 'Provider fill quantity is authoritative for reconciliation.'
          : 'Local order is consistent with provider truth.',
    });
  }

  for (const provider of providerOrders) {
    if (matchedProviderIds.has(provider.providerOrderId)) continue;
    deltas.push({
      providerOrderId: provider.providerOrderId,
      disposition: 'ORPHAN_PROVIDER_ORDER',
      providerStatus: provider.status,
      normalizedProviderState: mapProviderOrderStatus(provider.status),
      providerFilledQuantity: provider.filledQuantity,
      reason: 'Provider order has no matching local order; do not auto-adopt or resubmit.',
    });
  }

  return deltas;
}
