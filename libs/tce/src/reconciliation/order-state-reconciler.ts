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
  // Identity matching can be transitive across providerOrderId and clientRequestId.
  // Build connected components so every related local/provider row is treated as one
  // reconciliation unit instead of classifying a neighbor as missing or orphaned.
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
  // Provider order IDs must be unique in the snapshot itself; duplicate rows for
  // the same ID are ambiguous even if they share all visible fields.
  const providerRowCounts = new Map<string, number>();
  for (const provider of providerOrders) {
    providerRowCounts.set(provider.providerOrderId, (providerRowCounts.get(provider.providerOrderId) ?? 0) + 1);
  }

  // Mark ambiguity across the complete bipartite identity graph before emitting
  // any deltas. This prevents an unvisited local from being classified as missing
  // while another local has already proven the same graph ambiguous.
  const localIdsByProviderId = new Map<string, Set<string>>();
  const providerIdsByLocalId = new Map<string, Set<string>>();
  const providerIdsByClientRequestId = new Map<string, Set<string>>();
  const localIdsByClientRequestId = new Map<string, Set<string>>();

  for (let localIndex = 0; localIndex < localOrders.length; localIndex++) {
    const local = localOrders[localIndex]!;
    const matchingProviders = providersByLocal[localIndex]!;
    providerIdsByLocalId.set(
      local.id,
      new Set(matchingProviders.map(provider => provider.providerOrderId))
    );
    if (local.clientRequestId) {
      const localIds = localIdsByClientRequestId.get(local.clientRequestId) ?? new Set<string>();
      localIds.add(local.id);
      localIdsByClientRequestId.set(local.clientRequestId, localIds);
    }

    for (const provider of matchingProviders) {
      const matchingLocalIds = localIdsByProviderId.get(provider.providerOrderId) ?? new Set<string>();
      matchingLocalIds.add(local.id);
      localIdsByProviderId.set(provider.providerOrderId, matchingLocalIds);
      if (provider.clientRequestId) {
        const requestProviderIds = providerIdsByClientRequestId.get(provider.clientRequestId) ?? new Set<string>();
        requestProviderIds.add(provider.providerOrderId);
        providerIdsByClientRequestId.set(provider.clientRequestId, requestProviderIds);
      }
    }
  }

  const ambiguousLocalIds = new Set<string>();
  const ambiguousProviderIds = new Set<string>();
  const ambiguousRequestIds = new Set(
    localOrders
      .filter(local => !!local.clientRequestId)
      .map(local => local.clientRequestId!)
      .filter(requestId =>
        (localIdsByClientRequestId.get(requestId)?.size ?? 0) > 1 ||
        providerOrders.filter(provider => provider.clientRequestId === requestId).length > 1
      )
  );
  const localQueue: string[] = [];
  for (const local of localOrders) {
    const matchedProviderIds = providerIdsByLocalId.get(local.id) ?? new Set<string>();
    const ambiguousByProviderId = [...matchedProviderIds].some(
      providerId =>
        (localIdsByProviderId.get(providerId)?.size ?? 0) > 1 ||
        (providerRowCounts.get(providerId) ?? 0) > 1
    );
    const ambiguousByRequestId =
      !!local.clientRequestId &&
      ((localIdsByClientRequestId.get(local.clientRequestId)?.size ?? 0) > 1 ||
        providerOrders.some(
          provider =>
            provider.clientRequestId === local.clientRequestId &&
            provider.providerOrderId !== local.providerOrderId
        ));
    if (matchedProviderIds.size > 1 || ambiguousByProviderId || ambiguousByRequestId) {
      ambiguousLocalIds.add(local.id);
      localQueue.push(local.id);
    }
  }

  while (localQueue.length > 0) {
    const localId = localQueue.pop()!;
    const local = localOrders.find(candidate => candidate.id === localId);
    if (!local) continue;

    for (const providerId of providerIdsByLocalId.get(localId) ?? []) {
      if (ambiguousProviderIds.has(providerId)) continue;
      ambiguousProviderIds.add(providerId);
      for (const relatedLocalId of localIdsByProviderId.get(providerId) ?? []) {
        if (!ambiguousLocalIds.has(relatedLocalId)) {
          ambiguousLocalIds.add(relatedLocalId);
          localQueue.push(relatedLocalId);
        }
      }
    }

    if (local.clientRequestId) {
      // A request ID may be present on provider rows that do not match the
      // local via providerOrderId; all of those provider IDs are part of this
      // ambiguous identity component.
      for (const provider of providerOrders) {
        if (provider.clientRequestId !== local.clientRequestId) continue;
        ambiguousProviderIds.add(provider.providerOrderId);
        matchedProviderIds.add(provider.providerOrderId);
        for (const relatedLocalId of localIdsByProviderId.get(provider.providerOrderId) ?? []) {
          if (!ambiguousLocalIds.has(relatedLocalId)) {
            ambiguousLocalIds.add(relatedLocalId);
            localQueue.push(relatedLocalId);
          }
        }
      }
      for (const provider of providerOrders) {
        if (provider.clientRequestId !== local.clientRequestId) continue;
        ambiguousProviderIds.add(provider.providerOrderId);
        matchedProviderIds.add(provider.providerOrderId);
        for (const candidateLocal of localOrders) {
          if (
            providerIdsByLocalId.get(candidateLocal.id)?.has(provider.providerOrderId) ||
            candidateLocal.clientRequestId === local.clientRequestId
          ) {
            if (!ambiguousLocalIds.has(candidateLocal.id)) {
              ambiguousLocalIds.add(candidateLocal.id);
              localQueue.push(candidateLocal.id);
            }
          }
        }
      }
      for (const relatedLocalId of localIdsByClientRequestId.get(local.clientRequestId) ?? []) {
        if (!ambiguousLocalIds.has(relatedLocalId)) {
          ambiguousLocalIds.add(relatedLocalId);
          localQueue.push(relatedLocalId);
        }
      }
    }

    for (const provider of providerOrders) {
      if (provider.clientRequestId && provider.clientRequestId === local.clientRequestId) {
        if (!ambiguousProviderIds.has(provider.providerOrderId)) {
          ambiguousProviderIds.add(provider.providerOrderId);
          for (const relatedLocalId of localIdsByProviderId.get(provider.providerOrderId) ?? []) {
            if (!ambiguousLocalIds.has(relatedLocalId)) {
              ambiguousLocalIds.add(relatedLocalId);
              localQueue.push(relatedLocalId);
            }
          }
        }
      }
    }
  }

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
      // Each local should produce one fail-closed result even when several provider
      // rows point to it; the provider IDs are tracked so the final sweep emits no
      // duplicate provider-only deltas.
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
      // The identity graph was pre-scanned, so this local may already be known
      // ambiguous even if no provider row is unique to it.
      deltas.push({
        localOrderId: local.id,
        disposition: ambiguousLocalIds.has(local.id)
          ? 'RECONCILIATION_REQUIRED'
          : 'MISSING_PROVIDER_ORDER',
        localStatus: local.status,
        localFilledQuantity: local.filledQuantity,
        reason: ambiguousLocalIds.has(local.id)
          ? 'Local order is part of an ambiguous provider identity mapping.'
          : 'Local order has no matching provider order.',
      });
      continue;
    }

    matchedProviderIds.add(provider.providerOrderId);
    if ((localMatchCountsByProviderId.get(provider.providerOrderId) ?? 0) > 1) {
      ambiguousLocalIds.add(local.id);
      ambiguousProviderIds.add(provider.providerOrderId);
      matchedProviderIds.add(provider.providerOrderId);
      for (const matchedProvider of providerOrders) {
        if (identityMatches(local, matchedProvider)) {
          ambiguousProviderIds.add(matchedProvider.providerOrderId);
          matchedProviderIds.add(matchedProvider.providerOrderId);
        }
      }
      for (const otherLocal of localOrders) {
        if (identityMatches(otherLocal, provider)) ambiguousLocalIds.add(otherLocal.id);
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

  const matchedRequestIds = new Set(
    providerOrders
      .filter(provider => matchedProviderIds.has(provider.providerOrderId))
      .map(provider => provider.clientRequestId)
      .filter((requestId): requestId is string => !!requestId)
  );

  for (const provider of providerOrders) {
    if (ambiguousProviderIds.has(provider.providerOrderId)) continue;
    if (matchedProviderIds.has(provider.providerOrderId)) continue;
    if (
      provider.clientRequestId &&
      (matchedRequestIds.has(provider.clientRequestId) ||
        localOrders.some(local => local.clientRequestId === provider.clientRequestId))
    ) continue;
    // Don't classify a provider as an orphan when another local order already
    // matches a provider row carrying the same client request ID.
    if (
      provider.clientRequestId &&
      (ambiguousRequestIds.has(provider.clientRequestId) ||
        providerOrders.some(
          candidate =>
            candidate.providerOrderId !== provider.providerOrderId &&
            candidate.clientRequestId === provider.clientRequestId &&
            matchedProviderIds.has(candidate.providerOrderId)
        ))
    ) {
      continue;
    }
    // Even a provider row that does not share the provider ID is not an orphan
    // when its client request ID belongs to an ambiguous local component.
    if (
      provider.clientRequestId &&
      (ambiguousRequestIds.has(provider.clientRequestId) ||
        providerOrders.some(candidate =>
          candidate.providerOrderId !== provider.providerOrderId &&
          candidate.clientRequestId === provider.clientRequestId &&
          matchedProviderIds.has(candidate.providerOrderId)
        ))
    ) {
      continue;
    }
    const ambiguousCandidateLocalIds = localOrders
      .filter(local => identityMatches(local, provider))
      .map(local => local.id)
      .filter(localId => ambiguousLocalIds.has(localId));
    if (
      ambiguousCandidateLocalIds.length > 0 ||
      (provider.clientRequestId &&
        localOrders.some(
          local =>
            local.clientRequestId === provider.clientRequestId &&
            (ambiguousLocalIds.has(local.id) ||
              (localMatchCountsByProviderId.get(provider.providerOrderId) ?? 0) > 1)
        ))
    ) {
      // Local-order rows above already carry the reconciliation-required result
      // for this ambiguous identity graph. Suppress duplicate provider-only rows.
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
