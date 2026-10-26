export type PositionPool = 'A' | 'B' | 'C';

export type LocalPosition = Readonly<{
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
  targetPrice?: number;
  status: 'OPEN' | 'CLOSED';
  slotId?: string;
  pool?: PositionPool;
  sellableQuantity?: number;
}>;

export type ProviderPosition = Readonly<{
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketPrice?: number;
  sellableQuantity?: number;
}>;

export type PositionReconciliationDisposition =
  | 'CONVERGED'
  | 'LOCAL_ONLY'
  | 'PROVIDER_ONLY'
  | 'MISMATCH'
  | 'AMBIGUOUS'
  | 'RECONCILIATION_REQUIRED';

export type PositionReconciliationItem = Readonly<{
  symbol: string;
  disposition: PositionReconciliationDisposition;
  localPositions: readonly LocalPosition[];
  providerPositions: readonly ProviderPosition[];
  quantityDelta?: number;
  averagePriceDelta?: number;
  reason: string;
  exitDataComplete: boolean;
}>;

export type PositionReconciliationResult = Readonly<{
  complete: boolean;
  exitDataComplete: boolean;
  positions: readonly PositionReconciliationItem[];
  missingProviderSymbols: readonly string[];
  unexpectedProviderSymbols: readonly string[];
  ambiguousSymbols: readonly string[];
  invalidSymbols: readonly string[];
}>;

const QUANTITY_TOLERANCE = 1e-8;
const AVERAGE_PRICE_TOLERANCE = 0.01;

export function normalizePositionSymbol(symbol: unknown): string {
  return typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
}

export function localPositionValidationError(position: LocalPosition): string | undefined {
  if (!position || typeof position !== 'object') return 'Local position is required.';
  if (typeof position.id !== 'string' || !position.id.trim()) return 'Local position id is required.';
  if (!normalizePositionSymbol(position.symbol)) return 'Local position symbol is required.';
  if (position.status !== 'OPEN' && position.status !== 'CLOSED') {
    return 'Local position status is invalid.';
  }
  if (!Number.isFinite(position.quantity) || position.quantity < 0) {
    return 'Local position quantity must be a finite non-negative number.';
  }
  if (!Number.isFinite(position.avgCost) || position.avgCost < 0) {
    return 'Local position average cost must be a finite non-negative number.';
  }
  if (position.status === 'OPEN' && (position.quantity <= 0 || position.avgCost <= 0)) {
    return 'Open local positions require positive quantity and average cost.';
  }
  if (position.status === 'CLOSED' && position.quantity !== 0) {
    return 'Closed local positions must have zero quantity.';
  }
  if (position.currentPrice !== undefined &&
      (!Number.isFinite(position.currentPrice) || position.currentPrice <= 0)) {
    return 'Local position current price must be positive when supplied.';
  }
  if (position.targetPrice !== undefined &&
      (!Number.isFinite(position.targetPrice) || position.targetPrice <= 0)) {
    return 'Local position target price must be positive when supplied.';
  }
  if (position.sellableQuantity !== undefined &&
      (!Number.isFinite(position.sellableQuantity) ||
       position.sellableQuantity < 0 ||
       position.sellableQuantity > position.quantity)) {
    return 'Local position sellable quantity is outside its valid range.';
  }
  if (position.pool !== undefined && !(['A', 'B', 'C'] as const).includes(position.pool)) {
    return 'Local position pool is invalid.';
  }
  return undefined;
}

export function providerPositionValidationError(position: ProviderPosition): string | undefined {
  if (!position || typeof position !== 'object') return 'Provider position is required.';
  if (!normalizePositionSymbol(position.symbol)) return 'Provider position symbol is required.';
  if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
    return 'Provider position quantity must be finite and positive.';
  }
  if (!Number.isFinite(position.averagePrice) || position.averagePrice <= 0) {
    return 'Provider average price must be finite and positive.';
  }
  if (position.marketPrice !== undefined &&
      (!Number.isFinite(position.marketPrice) || position.marketPrice <= 0)) {
    return 'Provider market price must be positive when supplied.';
  }
  if (position.sellableQuantity !== undefined &&
      (!Number.isFinite(position.sellableQuantity) ||
       position.sellableQuantity < 0 ||
       position.sellableQuantity > position.quantity)) {
    return 'Provider sellable quantity is outside its valid range.';
  }
  return undefined;
}

export function assertValidLocalPosition(position: LocalPosition): void {
  const error = localPositionValidationError(position);
  if (error) throw new Error(error);
}

function addToGroup<T>(groups: Map<string, T[]>, symbol: string, position: T): void {
  const group = groups.get(symbol) ?? [];
  group.push(position);
  groups.set(symbol, group);
}

function exitDataIsComplete(
  local: LocalPosition,
  provider: ProviderPosition
): boolean {
  return Boolean(
    local.slotId?.trim() &&
    local.pool &&
    Number.isFinite(local.targetPrice) &&
    (local.targetPrice ?? 0) > 0 &&
    Number.isFinite(provider.marketPrice) &&
    (provider.marketPrice ?? 0) > 0 &&
    Number.isFinite(provider.sellableQuantity) &&
    (provider.sellableQuantity ?? 0) > 0
  );
}

/**
 * Compares a current local snapshot with a successfully fetched provider holdings snapshot.
 * This function is pure: it reports discrepancies and never adopts, closes, persists or trades.
 */
export function reconcilePositionState(
  localPositions: readonly LocalPosition[],
  providerPositions: readonly ProviderPosition[]
): PositionReconciliationResult {
  const localGroups = new Map<string, LocalPosition[]>();
  const providerGroups = new Map<string, ProviderPosition[]>();
  const items: PositionReconciliationItem[] = [];

  for (const local of localPositions) {
    const symbol = normalizePositionSymbol(local?.symbol);
    const error = localPositionValidationError(local);
    if (error) {
      items.push({
        symbol,
        disposition: 'RECONCILIATION_REQUIRED',
        localPositions: [local],
        providerPositions: [],
        reason: error,
        exitDataComplete: false,
      });
      continue;
    }
    if (local.status === 'CLOSED') continue;
    addToGroup(localGroups, symbol, local);
  }

  for (const provider of providerPositions) {
    const symbol = normalizePositionSymbol(provider?.symbol);
    const error = providerPositionValidationError(provider);
    if (error) {
      items.push({
        symbol,
        disposition: 'RECONCILIATION_REQUIRED',
        localPositions: [],
        providerPositions: [provider],
        reason: error,
        exitDataComplete: false,
      });
      continue;
    }
    addToGroup(providerGroups, symbol, provider);
  }

  const symbols = [...new Set([...localGroups.keys(), ...providerGroups.keys()])].sort();
  for (const symbol of symbols) {
    const localMatches = localGroups.get(symbol) ?? [];
    const providerMatches = providerGroups.get(symbol) ?? [];

    if (localMatches.length > 1 || providerMatches.length > 1) {
      items.push({
        symbol,
        disposition: 'AMBIGUOUS',
        localPositions: localMatches,
        providerPositions: providerMatches,
        reason: 'Multiple local or provider rows share the normalized symbol; no row was selected.',
        exitDataComplete: false,
      });
      continue;
    }

    const local = localMatches[0];
    const provider = providerMatches[0];
    if (!local && provider) {
      items.push({
        symbol,
        disposition: 'PROVIDER_ONLY',
        localPositions: [],
        providerPositions: [provider],
        reason: 'Provider holding has no matching local position; do not auto-adopt it.',
        exitDataComplete: false,
      });
      continue;
    }
    if (local && !provider) {
      items.push({
        symbol,
        disposition: 'LOCAL_ONLY',
        localPositions: [local],
        providerPositions: [],
        reason: 'Local position is absent from the provider snapshot; do not auto-close it.',
        exitDataComplete: false,
      });
      continue;
    }
    if (!local || !provider) continue;

    const quantityDelta = provider.quantity - local.quantity;
    const averagePriceDelta = provider.averagePrice - local.avgCost;
    const mismatchReasons: string[] = [];
    if (Math.abs(quantityDelta) > QUANTITY_TOLERANCE) {
      mismatchReasons.push('Quantity differs between local and provider snapshots.');
    }
    if (Math.abs(averagePriceDelta) > AVERAGE_PRICE_TOLERANCE) {
      mismatchReasons.push('Average price differs between local and provider snapshots.');
    }

    const disposition = mismatchReasons.length ? 'MISMATCH' : 'CONVERGED';
    items.push({
      symbol,
      disposition,
      localPositions: [local],
      providerPositions: [provider],
      quantityDelta,
      averagePriceDelta,
      reason: mismatchReasons.length
        ? mismatchReasons.join(' ')
        : 'Local quantity and average price match provider truth.',
      exitDataComplete: disposition === 'CONVERGED' && exitDataIsComplete(local, provider),
    });
  }

  items.sort((a, b) =>
    a.symbol.localeCompare(b.symbol) || a.disposition.localeCompare(b.disposition)
  );
  const complete = items.every(item => item.disposition === 'CONVERGED');
  const missingProviderSymbols = items
    .filter(item => item.disposition === 'LOCAL_ONLY')
    .map(item => item.symbol);
  const unexpectedProviderSymbols = items
    .filter(item => item.disposition === 'PROVIDER_ONLY')
    .map(item => item.symbol);
  const ambiguousSymbols = items
    .filter(item => item.disposition === 'AMBIGUOUS')
    .map(item => item.symbol);
  const invalidSymbols = items
    .filter(item => item.disposition === 'RECONCILIATION_REQUIRED')
    .map(item => item.symbol);

  return {
    complete,
    exitDataComplete: complete && items.every(item => item.exitDataComplete),
    positions: items,
    missingProviderSymbols,
    unexpectedProviderSymbols,
    ambiguousSymbols,
    invalidSymbols,
  };
}
