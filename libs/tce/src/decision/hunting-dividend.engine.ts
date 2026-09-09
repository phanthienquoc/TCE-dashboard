import {
  type CapitalPoolId,
  type DecisionEngine,
  type DecisionEngineContext,
  type TradeDecision,
} from '@tce/contracts';

const POOLS: CapitalPoolId[] = ['A', 'B', 'C'];

export class HuntingDividendDecisionEngine implements DecisionEngine {
  readonly id = 'hunting_dividend';

  constructor(
    private readonly options: {
      lookbackDays?: number;
      tpPercent?: number;
      slotsPerPool?: number;
      maxHoldDays?: number;
    } = {},
  ) {}

  decide(context: DecisionEngineContext): TradeDecision[] {
    const lookbackDays = Number(this.options.lookbackDays ?? context.config?.lookbackDays ?? 30);
    const tpPercent = Number(this.options.tpPercent ?? context.config?.tpPercent ?? 5);
    const slotsPerPool = Math.max(
      1,
      Number(this.options.slotsPerPool ?? context.config?.slotsPerPool ?? 1),
    );
    const maxHoldDays = Number(this.options.maxHoldDays ?? context.config?.maxHoldDays ?? 30);
    const now = new Date(context.timestamp).getTime();
    const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;
    const occupiedSymbols = new Set(context.positions.map(position => position.symbol.toUpperCase()));
    const occupiedSlots = new Set(context.positions.map(position => position.slot));

    const candidates = context.candidates
      .filter(candidate => {
        if (!candidate.symbol || !Number.isFinite(candidate.price) || candidate.price <= 0) return false;
        if (!candidate.gdkhqTimestamp) return true;
        const eventTime = new Date(candidate.gdkhqTimestamp).getTime();
        return Number.isFinite(eventTime) && eventTime >= cutoff && eventTime <= now;
      })
      .filter(candidate => !occupiedSymbols.has(candidate.symbol.toUpperCase()))
      .sort((a, b) => candidateScore(b) - candidateScore(a));

    const poolStates = new Map(context.pools.map(pool => [pool.pool, pool]));
    const decisions: TradeDecision[] = [];
    let candidateIndex = 0;

    for (const pool of POOLS) {
      const state = poolStates.get(pool);
      if (!state || state.availableCapital <= 0) continue;
      const slotCapital = state.allocatedCapital / slotsPerPool;
      for (let slotIndex = 1; slotIndex <= slotsPerPool; slotIndex += 1) {
        const slot = `${pool}${slotIndex}`;
        if (occupiedSlots.has(slot)) continue;
        const candidate = candidates[candidateIndex++];
        if (!candidate) break;
        const allocation = Math.min(slotCapital, state.availableCapital);
        decisions.push({
          engine: this.id,
          decision: 'BUY',
          symbol: candidate.symbol.toUpperCase(),
          pool,
          slot,
          capital: allocation,
          maxPrice: candidate.price,
          tpPercent,
          maxHoldDays,
          confidence: normalizedConfidence(candidate),
          reasons: ['dividend_event_in_window', 'candidate_ranked', 'slot_available'],
          timestamp: context.timestamp,
        });
      }
    }

    return decisions;
  }
}

function candidateScore(candidate: Record<string, unknown>): number {
  const dividend = Number(candidate.dividendValue ?? 0);
  const pnl = Number(candidate.realPnl ?? 0);
  const price = Number(candidate.price ?? 0);
  const ratio = Number(String(candidate.dividendRatio ?? '').replace('%', ''));
  return (Number.isFinite(ratio) ? ratio : 0) * 2 + dividend / Math.max(price, 1) * 100 + (Number.isFinite(pnl) ? pnl : 0);
}

function normalizedConfidence(candidate: Record<string, unknown>): number {
  return Math.max(0, Math.min(1, candidateScore(candidate) / 100));
}
