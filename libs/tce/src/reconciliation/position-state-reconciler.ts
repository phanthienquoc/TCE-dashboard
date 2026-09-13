export type PositionStatus = 'OPEN' | 'CLOSED';

export type LocalPosition = {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
  targetPrice?: number;
  sellableAt?: string;
  status: PositionStatus;
  slotId?: string;
  pool?: 'A' | 'B' | 'C';
};

export type ProviderPosition = {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
};

export type PositionReconciliationDisposition =
  | 'CONVERGED'
  | 'UPDATED'
  | 'MISSING_PROVIDER_POSITION'
  | 'UNEXPECTED_PROVIDER_POSITION'
  | 'RECONCILIATION_REQUIRED';

export type PositionReconciliationDelta = {
  symbol: string;
  disposition: PositionReconciliationDisposition;
  localQuantity?: number;
  providerQuantity?: number;
  localAvgCost?: number;
  providerAvgCost?: number;
  reason: string;
};

function key(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function validPosition(position: ProviderPosition): boolean {
  return (
    key(position.symbol).length > 0 &&
    Number.isFinite(position.quantity) &&
    position.quantity > 0 &&
    Number.isFinite(position.avgCost) &&
    position.avgCost > 0
  );
}

export function reconcilePositionStates(
  localPositions: readonly LocalPosition[],
  providerPositions: readonly ProviderPosition[]
): PositionReconciliationDelta[] {
  const localBySymbol = new Map(localPositions.map(position => [key(position.symbol), position]));
  const providerBySymbol = new Map<string, ProviderPosition>();
  const deltas: PositionReconciliationDelta[] = [];

  for (const provider of providerPositions) {
    const symbol = key(provider.symbol);
    if (!validPosition(provider) || providerBySymbol.has(symbol)) {
      deltas.push({
        symbol: symbol || 'UNKNOWN',
        disposition: 'RECONCILIATION_REQUIRED',
        reason: 'Provider position is invalid or duplicated; authoritative truth is ambiguous.',
      });
      continue;
    }
    providerBySymbol.set(symbol, provider);
  }

  for (const local of localPositions) {
    const symbol = key(local.symbol);
    const provider = providerBySymbol.get(symbol);
    if (!provider) {
      deltas.push({
        symbol,
        disposition: 'MISSING_PROVIDER_POSITION',
        localQuantity: local.quantity,
        localAvgCost: local.avgCost,
        reason: 'Local open position has no matching provider holding.',
      });
      continue;
    }

    if (local.quantity === provider.quantity && local.avgCost === provider.avgCost) {
      deltas.push({
        symbol,
        disposition: 'CONVERGED',
        localQuantity: local.quantity,
        providerQuantity: provider.quantity,
        localAvgCost: local.avgCost,
        providerAvgCost: provider.avgCost,
        reason: 'Local position is consistent with provider truth.',
      });
    } else {
      deltas.push({
        symbol,
        disposition: 'UPDATED',
        localQuantity: local.quantity,
        providerQuantity: provider.quantity,
        localAvgCost: local.avgCost,
        providerAvgCost: provider.avgCost,
        reason: 'Provider quantity/average cost is authoritative for reconciliation.',
      });
    }
  }

  for (const [symbol, provider] of providerBySymbol) {
    if (localBySymbol.has(symbol)) continue;
    deltas.push({
      symbol,
      disposition: 'UNEXPECTED_PROVIDER_POSITION',
      providerQuantity: provider.quantity,
      providerAvgCost: provider.avgCost,
      reason: 'Provider holding has no matching local position; do not auto-adopt.',
    });
  }

  return deltas;
}
