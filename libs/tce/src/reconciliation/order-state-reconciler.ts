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

function quantityValidationReason(
  quantity: number,
  filledQuantity: number,
  label: string
): string | undefined {
  if (!Number.isFinite(quantity) || !Number.isFinite(filledQuantity))
    return `${label} quantity and filled quantity must be finite numbers.`;
  if (quantity <= 0) return `${label} quantity must be greater than zero.`;
  if (filledQuantity < 0) return `${label} filled quantity cannot be negative.`;
  if (filledQuantity > quantity) return `${label} filled quantity exceeds order quantity.`;
  return undefined;
}

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
  const deltas: ReconciliationDelta[] = [];
  const providerIdsByLocal = new Map<string, Set<string>>();
  const localIdsByProvider = new Map<string, Set<string>>();
  const localIdsByRequest = new Map<string, Set<string>>();
  const providerIdsByRequest = new Map<string, Set<string>>();
  const providerRowsById = new Map<string, ProviderReconciliationOrder[]>();

  for (const local of localOrders) {
    const localIds = localIdsByRequest.get(local.clientRequestId ?? '') ?? new Set<string>();
    if (local.clientRequestId) {
      localIds.add(local.id);
      localIdsByRequest.set(local.clientRequestId, localIds);
    }
  }
  for (const provider of providerOrders) {
    const rows = providerRowsById.get(provider.providerOrderId) ?? [];
    rows.push(provider);
    providerRowsById.set(provider.providerOrderId, rows);
    if (provider.clientRequestId) {
      const ids = providerIdsByRequest.get(provider.clientRequestId) ?? new Set<string>();
      ids.add(provider.providerOrderId);
      providerIdsByRequest.set(provider.clientRequestId, ids);
    }
  }

  const providersByLocal = new Map<string, ProviderReconciliationOrder[]>();
  for (const local of localOrders) {
    const matches = providerOrders.filter(provider => identityMatches(local, provider));
    providersByLocal.set(local.id, matches);
    providerIdsByLocal.set(local.id, new Set(matches.map(provider => provider.providerOrderId)));
    for (const provider of matches) {
      const ids = localIdsByProvider.get(provider.providerOrderId) ?? new Set<string>();
      ids.add(local.id);
      localIdsByProvider.set(provider.providerOrderId, ids);
    }
  }

  // Identity links are transitive: a provider order ID can connect one local order,
  // while the same client request ID connects that provider row to another local/provider.
  // Find connected components before classifying any individual row.
  const ambiguousLocalIds = new Set<string>();
  const ambiguousProviderIds = new Set<string>();
  const ambiguousRequestIds = new Set<string>();
  const queue: string[] = [];
  for (const local of localOrders) {
    const matches = providersByLocal.get(local.id) ?? [];
    const providerIds = providerIdsByLocal.get(local.id) ?? new Set<string>();
    const ambiguous =
      providerIds.size > 1 ||
      matches.some(provider =>
        (localIdsByProvider.get(provider.providerOrderId)?.size ?? 0) > 1 ||
        (providerRowsById.get(provider.providerOrderId)?.length ?? 0) > 1
      ) ||
      (!!local.clientRequestId &&
        ((localIdsByRequest.get(local.clientRequestId)?.size ?? 0) > 1 ||
          (providerIdsByRequest.get(local.clientRequestId)?.size ?? 0) > 1));
    if (ambiguous) {
      ambiguousLocalIds.add(local.id);
      queue.push(local.id);
    }
  }

  while (queue.length) {
    const localId = queue.pop()!;
    const local = localOrders.find(item => item.id === localId);
    if (!local) continue;
    if (local.clientRequestId) ambiguousRequestIds.add(local.clientRequestId);

    for (const providerId of providerIdsByLocal.get(localId) ?? []) {
      ambiguousProviderIds.add(providerId);
      for (const relatedLocalId of localIdsByProvider.get(providerId) ?? []) {
        if (!ambiguousLocalIds.has(relatedLocalId)) {
          ambiguousLocalIds.add(relatedLocalId);
          queue.push(relatedLocalId);
        }
      }
    }

    if (local.clientRequestId) {
      for (const provider of providerOrders) {
        if (provider.clientRequestId !== local.clientRequestId) continue;
        ambiguousProviderIds.add(provider.providerOrderId);
        for (const relatedLocalId of localIdsByProvider.get(provider.providerOrderId) ?? []) {
          if (!ambiguousLocalIds.has(relatedLocalId)) {
            ambiguousLocalIds.add(relatedLocalId);
            queue.push(relatedLocalId);
          }
        }
      }
      for (const relatedLocalId of localIdsByRequest.get(local.clientRequestId) ?? []) {
        if (!ambiguousLocalIds.has(relatedLocalId)) {
          ambiguousLocalIds.add(relatedLocalId);
          queue.push(relatedLocalId);
        }
      }
    }
  }

  const emittedLocalIds = new Set<string>();
  const accountedProviderIds = new Set<string>(ambiguousProviderIds);
  for (const local of localOrders) {
    const matches = providersByLocal.get(local.id) ?? [];
    const provider = matches[0];
    for (const matched of matches) accountedProviderIds.add(matched.providerOrderId);

    const localQuantityError = quantityValidationReason(
      local.quantity,
      local.filledQuantity,
      'Local order'
    );
    if (localQuantityError) {
      deltas.push({
        localOrderId: local.id,
        providerOrderId: matches.length === 1 ? provider?.providerOrderId : undefined,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider?.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider?.filledQuantity,
        reason: localQuantityError,
      });
      emittedLocalIds.add(local.id);
      continue;
    }

    if (ambiguousLocalIds.has(local.id)) {
      deltas.push({
        localOrderId: local.id,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider?.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider?.filledQuantity,
        reason:
          (local.clientRequestId &&
            (localIdsByRequest.get(local.clientRequestId)?.size ?? 0) > 1) ||
          [...(providerIdsByLocal.get(local.id) ?? [])].some(
            providerId => (localIdsByProvider.get(providerId)?.size ?? 0) > 1
          )
            ? 'Multiple local orders share this provider identity; reconciliation is required.'
            : 'Local/provider identity is ambiguous; reconciliation is required.',
      });
      emittedLocalIds.add(local.id);
      continue;
    }

    if (!provider) {
      deltas.push({
        localOrderId: local.id,
        disposition: 'MISSING_PROVIDER_ORDER',
        localStatus: local.status,
        localFilledQuantity: local.filledQuantity,
        reason: 'Local order has no matching provider order.',
      });
      emittedLocalIds.add(local.id);
      continue;
    }

    const providerQuantityError = quantityValidationReason(
      provider.quantity,
      provider.filledQuantity,
      'Provider order'
    );
    if (providerQuantityError) {
      deltas.push({
        localOrderId: local.id,
        providerOrderId: provider.providerOrderId,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider.filledQuantity,
        reason: providerQuantityError,
      });
      emittedLocalIds.add(local.id);
      continue;
    }

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
      emittedLocalIds.add(local.id);
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
    emittedLocalIds.add(local.id);
  }

  for (const provider of providerOrders) {
    if (accountedProviderIds.has(provider.providerOrderId)) continue;
    if (provider.clientRequestId && ambiguousRequestIds.has(provider.clientRequestId)) continue;
    const providerQuantityError = quantityValidationReason(
      provider.quantity,
      provider.filledQuantity,
      'Provider order'
    );
    if (providerQuantityError) {
      deltas.push({
        providerOrderId: provider.providerOrderId,
        disposition: 'RECONCILIATION_REQUIRED',
        providerStatus: provider.status,
        providerFilledQuantity: provider.filledQuantity,
        reason: providerQuantityError,
      });
      continue;
    }
    deltas.push({
      providerOrderId: provider.providerOrderId,
      disposition: 'ORPHAN_PROVIDER_ORDER',
      providerStatus: provider.status,
      normalizedProviderState: mapProviderOrderStatus(provider.status),
      providerFilledQuantity: provider.filledQuantity,
      reason: 'Provider order has no matching local order; do not auto-adopt or resubmit.',
    });
    accountedProviderIds.add(provider.providerOrderId);
  }

  return deltas;
}
