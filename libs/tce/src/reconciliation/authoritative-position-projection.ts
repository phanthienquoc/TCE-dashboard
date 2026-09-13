import type { LocalPosition, ProviderPosition } from './position-state-reconciler';

export type AuthoritativeHolding = Readonly<{
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
  targetPrice?: number;
  sellableAt?: string;
  slotId?: string;
  pool?: 'A' | 'B' | 'C';
  status: 'HOLDING';
  costBasis: number;
  unrealizedPnl?: number;
}>;

export type AuthoritativeProjection = Readonly<{
  authoritative: boolean;
  holdings: readonly AuthoritativeHolding[];
  reason?: string;
}>;

const symbolKey = (symbol: string) => symbol.trim().toUpperCase();

const validProvider = (position: ProviderPosition) =>
  symbolKey(position.symbol).length > 0 &&
  Number.isFinite(position.quantity) &&
  position.quantity > 0 &&
  Number.isFinite(position.avgCost) &&
  position.avgCost > 0 &&
  (position.currentPrice === undefined || (Number.isFinite(position.currentPrice) && position.currentPrice > 0));

export function projectAuthoritativeHoldings(
  localPositions: readonly LocalPosition[],
  providerPositions: readonly ProviderPosition[]
): AuthoritativeProjection {
  const providers = new Map<string, ProviderPosition>();
  for (const provider of providerPositions) {
    const symbol = symbolKey(provider.symbol);
    if (!validProvider(provider) || providers.has(symbol)) {
      return { authoritative: false, holdings: [], reason: 'Provider holdings are invalid or ambiguous.' };
    }
    providers.set(symbol, provider);
  }

  const locals = new Map<string, LocalPosition>();
  for (const local of localPositions) {
    const symbol = symbolKey(local.symbol);
    if (!symbol || locals.has(symbol)) {
      return { authoritative: false, holdings: [], reason: 'Local position identity is invalid or ambiguous.' };
    }
    locals.set(symbol, local);
  }

  const holdings: AuthoritativeHolding[] = [];
  for (const [symbol, provider] of providers) {
    const local = locals.get(symbol);
    if (!local) return { authoritative: false, holdings: [], reason: `Unexpected provider holding: ${symbol}.` };
    if (local.status !== 'OPEN') {
      return { authoritative: false, holdings: [], reason: `Local position is not open: ${symbol}.` };
    }
    const currentPrice = provider.currentPrice;
    holdings.push({
      id: local.id,
      symbol,
      quantity: provider.quantity,
      avgCost: provider.avgCost,
      currentPrice,
      targetPrice: local.targetPrice,
      sellableAt: local.sellableAt,
      slotId: local.slotId,
      pool: local.pool,
      status: 'HOLDING',
      costBasis: provider.quantity * provider.avgCost,
      unrealizedPnl: currentPrice === undefined ? undefined : (currentPrice - provider.avgCost) * provider.quantity,
    });
  }

  for (const [symbol] of locals) {
    if (!providers.has(symbol)) return { authoritative: false, holdings: [], reason: `Missing provider holding: ${symbol}.` };
  }

  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { authoritative: true, holdings };
}
