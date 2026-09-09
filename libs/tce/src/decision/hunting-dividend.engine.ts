import {
  type CapitalPoolId,
  type DecisionEngine,
  type DecisionEngineContext,
  type DecisionSnapshot,
  type TradeDecision,
} from '@tce/contracts';

const POOLS: CapitalPoolId[] = ['A', 'B', 'C'];
export const HUNTING_DIVIDEND_STRATEGY_VERSION = 'hunting_dividend.v2';

export type HuntingDividendDecisionOptions = {
  lookbackDays?: number;
  tpPercent?: number;
  invalidationPercent?: number;
  slotsPerPool?: number;
  maxHoldDays?: number;
  minConfidence?: number;
  strategyVersion?: string;
};

export class HuntingDividendDecisionEngine implements DecisionEngine {
  readonly id = 'hunting_dividend';

  constructor(private readonly options: HuntingDividendDecisionOptions = {}) {}

  decide(context: DecisionEngineContext): TradeDecision[] {
    const cfg = context.config ?? {};
    const lookbackDays = positive(this.options.lookbackDays ?? cfg.lookbackDays, 30);
    const tpPercent = positive(this.options.tpPercent ?? cfg.tpPercent, 5);
    const invalidationPercent = optionalPositive(this.options.invalidationPercent ?? cfg.invalidationPercent);
    const slotsPerPool = Math.max(1, Math.floor(positive(this.options.slotsPerPool ?? cfg.slotsPerPool, 1)));
    const maxHoldDays = positive(this.options.maxHoldDays ?? cfg.maxHoldDays, 30);
    const minConfidence = bounded(this.options.minConfidence ?? cfg.minConfidence, 0, 1, 0.5);
    const strategyVersion = String(this.options.strategyVersion ?? cfg.strategyVersion ?? HUNTING_DIVIDEND_STRATEGY_VERSION);
    const now = new Date(context.timestamp).getTime();
    if (!Number.isFinite(now)) return [];
    const cutoff = now - lookbackDays * DAY_MS;

    const occupiedSymbols = new Set(context.positions.map(p => p.symbol.trim().toUpperCase()));
    const occupiedSlots = new Set(context.positions.map(p => p.slot));
    const candidates = context.candidates
      .map((candidate, index) => ({ candidate, index, score: candidateScore(candidate) }))
      .filter(item => item.score !== null)
      .filter(item => inWindow(item.candidate.gdkhqTimestamp, cutoff, now))
      .filter(item => !occupiedSymbols.has(item.candidate.symbol.trim().toUpperCase()))
      .sort((a, b) => (b.score as number) - (a.score as number) || a.candidate.symbol.localeCompare(b.candidate.symbol) || a.index - b.index);

    const seenWindows = new Set<string>();
    const decisions: TradeDecision[] = [];
    const poolStates = new Map(context.pools.map(pool => [pool.pool, pool]));
    let candidateIndex = 0;

    for (const pool of POOLS) {
      const state = poolStates.get(pool);
      if (!state || !Number.isFinite(state.availableCapital) || state.availableCapital <= 0) continue;
      const slotCapital = state.allocatedCapital / slotsPerPool;
      if (!Number.isFinite(slotCapital) || slotCapital <= 0) continue;
      for (let slotIndex = 1; slotIndex <= slotsPerPool; slotIndex += 1) {
        const slot = `${pool}${slotIndex}`;
        if (occupiedSlots.has(slot)) continue;
        while (candidateIndex < candidates.length) {
          const item = candidates[candidateIndex++];
          const candidate = item.candidate;
          const confidence = normalizedConfidence(item.score as number);
          const candidateId = candidateIdOf(candidate, item.index);
          const eventKey = candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE';
          const windowKey = `${eventKey.slice(0, 10)}:${candidateId}`;
          const decisionId = `${strategyVersion}:${candidateId}:${slot}:${windowKey}`;
          if (seenWindows.has(decisionId)) continue;
          seenWindows.add(decisionId);
          if (confidence < minConfidence) continue;

          const entry = candidate.price;
          const target = round(entry * (1 + tpPercent / 100));
          const invalidation = invalidationPercent === undefined ? undefined : round(entry * (1 - invalidationPercent / 100));
          if (!Number.isFinite(target) || target <= entry) continue;
          if (invalidation !== undefined && (!Number.isFinite(invalidation) || invalidation <= 0 || invalidation >= entry)) continue;

          const allocation = Math.min(slotCapital, state.availableCapital);
          if (!Number.isFinite(allocation) || allocation <= 0) continue;
          const decision: TradeDecision = {
            engine: this.id,
            decision: 'BUY',
            symbol: candidate.symbol.trim().toUpperCase(),
            pool,
            slot,
            capital: allocation,
            maxPrice: entry,
            entry,
            target,
            invalidation,
            tpPercent,
            maxHoldDays,
            confidence,
            candidateId,
            decisionWindowKey: windowKey,
            decisionId,
            strategyVersion,
            reasons: ['dividend_event_in_window', 'candidate_ranked', 'confidence_above_threshold', 'slot_available', 'target_defined', ...(invalidation !== undefined ? ['invalidation_defined'] : [])],
            timestamp: context.timestamp,
          };
          decisions.push(decision);
          break;
        }
      }
    }
    return decisions;
  }

  snapshot(decision: TradeDecision): DecisionSnapshot {
    const decisionId = decision.decisionId ?? `${this.options.strategyVersion ?? HUNTING_DIVIDEND_STRATEGY_VERSION}:${decision.symbol ?? 'UNKNOWN'}:${decision.slot ?? 'UNASSIGNED'}:${decision.timestamp}`;
    return { decisionId, strategyVersion: decision.strategyVersion ?? HUNTING_DIVIDEND_STRATEGY_VERSION, decision: { ...decision, decisionId } };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function candidateScore(candidate: Record<string, unknown>): number | null {
  const price = Number(candidate.price);
  if (!candidate.symbol || !Number.isFinite(price) || price <= 0) return null;
  const dividend = Number(candidate.dividendValue ?? 0);
  const pnl = Number(candidate.realPnl ?? 0);
  const ratio = Number(String(candidate.dividendRatio ?? '').replace('%', ''));
  const ratioScore = Number.isFinite(ratio) ? ratio * 2 : 0;
  const dividendScore = Number.isFinite(dividend) ? dividend / price * 100 : 0;
  const pnlScore = Number.isFinite(pnl) ? pnl : 0;
  const score = ratioScore + dividendScore + pnlScore;
  return Number.isFinite(score) ? score : null;
}

function normalizedConfidence(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
}

function inWindow(timestamp: unknown, cutoff: number, now: number): boolean {
  if (!timestamp) return true;
  const value = new Date(String(timestamp)).getTime();
  return Number.isFinite(value) && value >= cutoff && value <= now;
}

function candidateIdOf(candidate: Record<string, unknown>, index: number): string {
  const explicit = candidate.id ?? candidate.candidateId ?? candidate.dividendEventId;
  if (explicit !== undefined && String(explicit).trim()) return String(explicit).trim();
  return `${String(candidate.symbol).trim().toUpperCase()}:${candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE'}:${index}`;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function optionalPositive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function bounded(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
