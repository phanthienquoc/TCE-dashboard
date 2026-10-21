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
  const matchedProviderIds = new Set<string>();
  const deltas: ReconciliationDelta[] = [];

  // Build the complete identity graph first. Matching must be one-to-one; choosing a
  // row inside the loop can otherwise reconcile one provider order against two locals.
  const providersByLocal = localOrders.map(local =>
    providerOrders.filter(candidate => identityMatches(local, candidate))
  );
  const localMatchCountsByProviderId = new Map<string, number>();
  for (const matchingProviders of providersByLocal) {
    for (const provider of matchingProviders) {
      localMatchCountsByProviderId.set(
        provider.providerOrderId,
        (localMatchCountsByProviderId.get(provider.providerOrderId) ?? 0) + 1
      );
    }
  }

  const ambiguousLocalIds = new Set<string>();
  const ambiguousProviderIds = new Set<string>();
  for (let localIndex = 0; localIndex < localOrders.length; localIndex++) {
    const local = localOrders[localIndex]!;
    const matchingProviders = providersByLocal[localIndex]!;
    const provider = matchingProviders[0];
    const localQuantityError = quantityValidationReason(
      local.quantity,
      local.filledQuantity,
      'Local order'
    );
    if (localQuantityError) {
      for (const match of matchingProviders) matchedProviderIds.add(match.providerOrderId);
      deltas.push({
        localOrderId: local.id,
        providerOrderId: matchingProviders.length === 1 ? provider?.providerOrderId : undefined,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider?.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider?.filledQuantity,
        reason: localQuantityError,
      });
      continue;
    }
    if (matchingProviders.length > 1) {
      ambiguousLocalIds.add(local.id);
      for (const match of matchingProviders) {
        matchedProviderIds.add(match.providerOrderId);
        ambiguousProviderIds.add(match.providerOrderId);
        for (const otherLocal of localOrders) {
          if (identityMatches(otherLocal, match)) ambiguousLocalIds.add(otherLocal.id);
        }
      }
      deltas.push({
        localOrderId: local.id,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider?.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider?.filledQuantity,
        reason: 'Multiple provider orders match this local identity; provider truth is ambiguous.',
      });
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
      continue;
    }

    matchedProviderIds.add(provider.providerOrderId);
    if ((localMatchCountsByProviderId.get(provider.providerOrderId) ?? 0) > 1) {
      ambiguousLocalIds.add(local.id);
      ambiguousProviderIds.add(provider.providerOrderId);
      for (const matchedProvider of matchingProviders) {
        ambiguousProviderIds.add(matchedProvider.providerOrderId);
        matchedProviderIds.add(matchedProvider.providerOrderId);
      }
      deltas.push({
        localOrderId: local.id,
        providerOrderId: provider.providerOrderId,
        disposition: 'RECONCILIATION_REQUIRED',
        localStatus: local.status,
        providerStatus: provider.status,
        localFilledQuantity: local.filledQuantity,
        providerFilledQuantity: provider.filledQuantity,
        reason:
          'One provider order matches multiple local orders; provider-to-local identity is ambiguous.',
      });
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
    if (ambiguousProviderIds.has(provider.providerOrderId)) continue;
    if (matchedProviderIds.has(provider.providerOrderId)) continue;
    const ambiguousCandidateLocalIds = localOrders
      .filter(local => identityMatches(local, provider))
      .map(local => local.id)
      .filter(localId => ambiguousLocalIds.has(localId));
    if (ambiguousCandidateLocalIds.length > 0 || localOrders.some(local => identityMatches(local, provider))) {
      deltas.push({
        providerOrderId: provider.providerOrderId,
        disposition: 'RECONCILIATION_REQUIRED',
        providerStatus: provider.status,
        providerFilledQuantity: provider.filledQuantity,
        reason:
          'Provider order is part of an ambiguous identity mapping; do not classify it as an orphan.',
      });
      continue;
    }
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
  }

  return deltas;
}
