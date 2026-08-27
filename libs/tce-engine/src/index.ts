import { TceEngineAccountState, TceEngineCandidate, TceEngineConfig, TceEngineDecision, TceEnginePort } from '@tce/contracts';

export const DEFAULT_TCE_ENGINE_CONFIG: TceEngineConfig = {
  enabled: false,
  profitTargetPct: 10,
  maxTotalAssets: 5,
  maxAssetAllocationPct: 40,
  buyQuantityStep: 100,
  buyFromRemainingBudget: true,
};

const finitePositive = (value: number | undefined, fallback: number) => Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : fallback;

export class TceEngine implements TceEnginePort {
  evaluate(state: TceEngineAccountState, config: TceEngineConfig): TceEngineDecision[] {
    const normalized = this.normalizeConfig(config);
    if (!normalized.enabled) return [{ action: 'HOLD', reason: 'engine_disabled' }];

    const decisions: TceEngineDecision[] = [];
    const totalAssetsValue = Math.max(0, Number(state.totalAssetsValue || 0));
    const availableBudget = Math.max(0, Number(state.availableBudget || 0));

    for (const position of state.positions) {
      const quantity = Math.max(0, Number(position.quantity || 0));
      const costBasis = Number(position.costBasis ?? (position.averagePrice * quantity));
      const marketValue = Number(position.marketValue ?? ((position.marketPrice ?? 0) * quantity));
      const profitPct = Number(position.unrealizedPnlPct ?? (costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : NaN));
      if (quantity > 0 && Number.isFinite(profitPct) && profitPct >= normalized.profitTargetPct) {
        decisions.push({ action: 'SELL', symbol: position.symbol, quantity, reason: 'profit_target_reached', profitPct: Number(profitPct.toFixed(4)) });
      }
    }

    const sellSymbols = new Set(decisions.filter((d) => d.action === 'SELL').map((d) => d.symbol.toUpperCase()));
    const openSymbols = new Set(state.positions.filter((p) => Number(p.quantity || 0) > 0 && !sellSymbols.has(p.symbol.toUpperCase())).map((p) => p.symbol.toUpperCase()));
    const projectedAssetCount = openSymbols.size;
    if (projectedAssetCount >= normalized.maxTotalAssets || availableBudget <= 0) return decisions.length ? decisions : [{ action: 'HOLD', reason: projectedAssetCount >= normalized.maxTotalAssets ? 'max_assets_reached' : 'no_available_budget' }];

    const candidate = this.pickCandidate(state.candidates, openSymbols);
    if (!candidate) return decisions.length ? decisions : [{ action: 'HOLD', reason: 'no_pool_candidate' }];

    const price = Number(candidate.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) return decisions.length ? decisions : [{ action: 'HOLD', reason: 'candidate_price_unavailable' }];

    const existingValue = Number(state.positions.find((p) => p.symbol.toUpperCase() === candidate.symbol.toUpperCase())?.marketValue ?? 0);
    const maxPositionValue = totalAssetsValue * (normalized.maxAssetAllocationPct / 100);
    const positionCapacity = Math.max(0, maxPositionValue - existingValue);
    const budgetForBuy = Math.min(availableBudget, positionCapacity);
    const quantity = Math.floor(budgetForBuy / price / normalized.buyQuantityStep) * normalized.buyQuantityStep;
    const estimatedValue = quantity * price;

    if (quantity < normalized.buyQuantityStep || estimatedValue <= 0) return decisions.length ? decisions : [{ action: 'HOLD', reason: 'budget_below_minimum_lot_or_allocation_capacity' }];

    decisions.push({ action: 'BUY', symbol: candidate.symbol.toUpperCase(), quantity, estimatedValue: Number(estimatedValue.toFixed(2)), reason: 'reinvest_remaining_budget_with_risk_cap' });
    return decisions;
  }

  private normalizeConfig(config: TceEngineConfig): TceEngineConfig {
    return {
      enabled: Boolean(config.enabled),
      profitTargetPct: Math.max(0, finitePositive(config.profitTargetPct, DEFAULT_TCE_ENGINE_CONFIG.profitTargetPct)),
      maxTotalAssets: Math.max(1, Math.floor(finitePositive(config.maxTotalAssets, DEFAULT_TCE_ENGINE_CONFIG.maxTotalAssets))),
      maxAssetAllocationPct: Math.min(100, finitePositive(config.maxAssetAllocationPct, DEFAULT_TCE_ENGINE_CONFIG.maxAssetAllocationPct)),
      buyQuantityStep: Math.max(1, Math.floor(finitePositive(config.buyQuantityStep, DEFAULT_TCE_ENGINE_CONFIG.buyQuantityStep))),
      buyFromRemainingBudget: config.buyFromRemainingBudget !== false,
    };
  }

  private pickCandidate(candidates: TceEngineCandidate[], openSymbols: Set<string>) {
    return [...candidates]
      .filter((candidate) => candidate.symbol && !openSymbols.has(candidate.symbol.toUpperCase()))
      .sort((a, b) => Number(a.rank ?? Number.MAX_SAFE_INTEGER) - Number(b.rank ?? Number.MAX_SAFE_INTEGER))[0];
  }
}

export const tceEngine = new TceEngine();
