import {
  type CapitalPoolId,
  type DecisionEngine,
  type DecisionEngineContext,
  type DecisionPositionState,
  type DecisionSnapshot,
  type DividendEntitlementStatus,
  type TradeDecision,
} from '@tce/contracts';

const POOLS: CapitalPoolId[] = ['A', 'B', 'C'];
export const HUNTING_DIVIDEND_STRATEGY_VERSION = 'hunting_dividend.v3';

export type HuntingDividendDecisionOptions = {
  lookbackDays?: number;
  tpPercent?: number;
  invalidationPercent?: number;
  slotsPerPool?: number;
  maxHoldDays?: number;
  minConfidence?: number;
  strategyVersion?: string;
};

const DEFAULTS = { lookbackDays: 30, tpPercent: 5, slotsPerPool: 1, maxHoldDays: 30, minConfidence: 0.5 };

type ResolvedConfig = typeof DEFAULTS & { invalidationPercent?: number; strategyVersion: string };
type DividendEvent = { exRightDate?: string; recordDate?: string; paymentDate?: string; dividendValue?: number; dividendNet?: number };

export class HuntingDividendDecisionEngine implements DecisionEngine {
  readonly id = 'hunting_dividend';
  constructor(private readonly options: HuntingDividendDecisionOptions = {}) {}

  decide(context: DecisionEngineContext): TradeDecision[] {
    const cfg = resolveConfig(context.config, this.options);
    const now = new Date(context.timestamp).getTime();
    if (!Number.isFinite(now)) return [];

    const decisions = this.decideExistingPositions(context, cfg, now);
    const occupiedSymbols = new Set(context.positions.map(p => normalizeSymbol(p.symbol)));
    const occupiedSlots = new Set(context.positions.map(p => p.slot));
    const candidates = context.candidates
      .map((candidate, index) => ({ candidate, index, score: candidateScore(candidate) }))
      .filter(item => item.score !== null)
      .filter(item => inWindow(item.candidate.gdkhqTimestamp, now - cfg.lookbackDays * DAY_MS, now))
      .filter(item => !occupiedSymbols.has(normalizeSymbol(item.candidate.symbol)))
      .sort((a, b) => (b.score as number) - (a.score as number) || normalizeSymbol(a.candidate.symbol).localeCompare(normalizeSymbol(b.candidate.symbol)) || a.index - b.index);

    const seen = new Set<string>();
    let candidateIndex = 0;
    for (const pool of POOLS) {
      const state = context.pools.find(p => p.pool === pool);
      if (!state || !Number.isFinite(state.availableCapital) || state.availableCapital <= 0) continue;
      const slotCapital = state.allocatedCapital / cfg.slotsPerPool;
      if (!Number.isFinite(slotCapital) || slotCapital <= 0) continue;
      for (let slotIndex = 1; slotIndex <= cfg.slotsPerPool; slotIndex += 1) {
        const slot = `${pool}${slotIndex}`;
        if (occupiedSlots.has(slot)) continue;
        while (candidateIndex < candidates.length) {
          const item = candidates[candidateIndex++];
          const candidate = item.candidate;
          const confidence = normalizedConfidence(item.score as number);
          const symbol = normalizeSymbol(candidate.symbol);
          const candidateId = candidateIdOf(candidate, item.index);
          const lifecycleWindow = (candidate.exRightDate ?? candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE').slice(0, 10);
          const decisionWindowKey = `${candidateId}:${lifecycleWindow}`;
          const decisionId = `${cfg.strategyVersion}:${symbol}:BUY:${slot}:${decisionWindowKey}`;
          if (seen.has(decisionId) || confidence < cfg.minConfidence) continue;
          seen.add(decisionId);
          const entry = Number(candidate.price);
          const target = round(entry * (1 + cfg.tpPercent / 100));
          const invalidation = cfg.invalidationPercent === undefined ? undefined : round(entry * (1 - cfg.invalidationPercent / 100));
          const allocation = Math.min(slotCapital, state.availableCapital);
          if (!Number.isFinite(target) || target <= entry || allocation <= 0) continue;
          if (invalidation !== undefined && (!Number.isFinite(invalidation) || invalidation <= 0 || invalidation >= entry)) continue;
          decisions.push({ engine: this.id, decision: 'BUY', symbol, pool, slot, capital: allocation, maxPrice: entry, entry, target, invalidation, tpPercent: cfg.tpPercent, maxHoldDays: cfg.maxHoldDays, confidence, dividendNet: optionalNumber(candidate.dividendNet), candidateId, decisionWindowKey, decisionId, strategyVersion: cfg.strategyVersion, reasons: ['dividend_event_in_window', 'candidate_ranked', 'confidence_above_threshold', 'slot_available', 'capital_available', 'target_defined'], timestamp: context.timestamp });
          break;
        }
      }
    }
    return deduplicate(decisions);
  }

  snapshot(decision: TradeDecision): DecisionSnapshot {
    const strategyVersion = decision.strategyVersion ?? this.options.strategyVersion ?? HUNTING_DIVIDEND_STRATEGY_VERSION;
    const decisionId = decision.decisionId ?? `${strategyVersion}:${decision.symbol ?? 'UNKNOWN'}:${decision.decision}:${decision.slot ?? 'UNASSIGNED'}:${decision.timestamp}`;
    return { decisionId, strategyVersion, decision: { ...decision, decisionId, strategyVersion } };
  }

  private decideExistingPositions(context: DecisionEngineContext, cfg: ResolvedConfig, now: number): TradeDecision[] {
    return context.positions.map(position => {
      const event = resolveEvent(context, position);
      const entitlement = resolveEntitlement(position, event, now);
      const symbol = normalizeSymbol(position.symbol);
      const window = (position.exRightDate ?? event?.exRightDate ?? position.recordDate ?? 'NO_EVENT_DATE').slice(0, 10);
      const decisionId = `${cfg.strategyVersion}:${symbol}:${entitlementAction(entitlement)}:${position.slot}:${window}`;
      if (entitlement === 'UNKNOWN') return basePositionDecision(position, 'WAIT', decisionId, cfg.strategyVersion, entitlement, ['dividend_entitlement_unknown'], context.timestamp);
      if (entitlement === 'AT_RISK' || entitlement === 'NOT_ELIGIBLE') return basePositionDecision(position, 'HOLD', decisionId, cfg.strategyVersion, entitlement, ['protect_dividend_entitlement'], context.timestamp);
      const profitNet = calculateProfitNet(position);
      const dividendNet = calculateDividendNet(position, event);
      const common = { profitNet, dividendNet, entitlementStatus: entitlement };
      if (profitNet !== undefined && dividendNet !== undefined && profitNet > dividendNet) return { ...basePositionDecision(position, 'SELL', decisionId, cfg.strategyVersion, entitlement, ['dividend_entitlement_protected', 'profit_net_exceeds_dividend_net'], context.timestamp), ...common };
      if (targetReached(position, cfg.tpPercent)) return { ...basePositionDecision(position, 'SELL', decisionId, cfg.strategyVersion, entitlement, ['dividend_entitlement_protected', 'target_reached_after_dividend_protection'], context.timestamp), ...common };
      return { ...basePositionDecision(position, 'HOLD', decisionId, cfg.strategyVersion, entitlement, ['continue_dividend_lifecycle'], context.timestamp), ...common };
    });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveConfig(config: Record<string, unknown> | undefined, options: HuntingDividendDecisionOptions): ResolvedConfig {
  const source = { ...(config ?? {}), ...options };
  return { lookbackDays: positive(source.lookbackDays, DEFAULTS.lookbackDays), tpPercent: positive(source.tpPercent, DEFAULTS.tpPercent), slotsPerPool: Math.max(1, Math.floor(positive(source.slotsPerPool, DEFAULTS.slotsPerPool))), maxHoldDays: positive(source.maxHoldDays, DEFAULTS.maxHoldDays), minConfidence: bounded(source.minConfidence, 0, 1, DEFAULTS.minConfidence), invalidationPercent: optionalPositive(source.invalidationPercent), strategyVersion: String(source.strategyVersion ?? HUNTING_DIVIDEND_STRATEGY_VERSION) };
}

function resolveEvent(context: DecisionEngineContext, position: DecisionPositionState): DividendEvent | undefined {
  const candidate = context.candidates.find(c => normalizeSymbol(c.symbol) === normalizeSymbol(position.symbol));
  if (!candidate && !position.exRightDate && !position.recordDate && !position.paymentDate && position.dividendNet === undefined && position.dividendGross === undefined) return undefined;
  return { exRightDate: position.exRightDate ?? candidate?.exRightDate, recordDate: position.recordDate ?? candidate?.recordDate, paymentDate: position.paymentDate ?? candidate?.paymentDate, dividendValue: candidate?.dividendValue, dividendNet: position.dividendNet ?? candidate?.dividendNet };
}

function resolveEntitlement(position: DecisionPositionState, event: DividendEvent | undefined, now: number): DividendEntitlementStatus {
  if (position.entitlementStatus) return position.entitlementStatus;
  if (!event?.exRightDate && !position.sellableAt) return 'UNKNOWN';
  const exDate = event?.exRightDate ? new Date(event.exRightDate).getTime() : Number.NaN;
  if (Number.isFinite(exDate) && now < exDate) return 'AT_RISK';
  if (position.sellableAt && now < new Date(position.sellableAt).getTime()) return 'PROTECTED';
  if (Number.isFinite(exDate) && now >= exDate) return 'PROTECTED';
  return 'UNKNOWN';
}
function calculateProfitNet(position: DecisionPositionState): number | undefined { if (position.entryPrice === undefined || position.currentPrice === undefined || !Number.isFinite(position.quantity) || position.quantity <= 0) return undefined; return (position.currentPrice - position.entryPrice) * position.quantity; }
function calculateDividendNet(position: DecisionPositionState, event: DividendEvent | undefined): number | undefined { if (position.dividendNet !== undefined && Number.isFinite(position.dividendNet)) return position.dividendNet; if (event?.dividendNet !== undefined && Number.isFinite(event.dividendNet)) return event.dividendNet; if (event?.dividendValue !== undefined && Number.isFinite(event.dividendValue)) return event.dividendValue * position.quantity; if (position.dividendGross !== undefined && Number.isFinite(position.dividendGross)) return position.dividendGross; return undefined; }
function targetReached(position: DecisionPositionState, tpPercent: number): boolean { if (position.currentPrice === undefined || !Number.isFinite(position.currentPrice)) return false; if (position.targetPrice !== undefined && Number.isFinite(position.targetPrice)) return position.currentPrice >= position.targetPrice; if (position.entryPrice === undefined || !Number.isFinite(position.entryPrice)) return false; return position.currentPrice >= position.entryPrice * (1 + tpPercent / 100); }
function basePositionDecision(position: DecisionPositionState, action: 'HOLD' | 'SELL' | 'WAIT', decisionId: string, strategyVersion: string, entitlementStatus: DividendEntitlementStatus, reasons: string[], timestamp: string): TradeDecision { return { engine: 'hunting_dividend', decision: action, symbol: normalizeSymbol(position.symbol), pool: position.pool, slot: position.slot, confidence: 1, entitlementStatus, decisionId, decisionWindowKey: decisionId.split(':').slice(-1)[0], strategyVersion, reasons, timestamp }; }
function entitlementAction(status: DividendEntitlementStatus): string { return status === 'PROTECTED' || status === 'CONFIRMED' ? 'EXIT_GATE' : 'HOLD_GATE'; }
function candidateScore(candidate: Record<string, unknown>): number | null { const price = Number(candidate.price); if (!candidate.symbol || !Number.isFinite(price) || price <= 0) return null; const dividend = Number(candidate.dividendValue ?? 0); const pnl = Number(candidate.realPnl ?? 0); const ratio = Number(String(candidate.dividendRatio ?? '').replace('%', '')); const score = (Number.isFinite(ratio) ? ratio * 2 : 0) + (Number.isFinite(dividend) ? (dividend / price) * 100 : 0) + (Number.isFinite(pnl) ? pnl : 0); return Number.isFinite(score) ? score : null; }
function normalizedConfidence(score: number): number { return Math.max(0, Math.min(1, score / 100)); }
function inWindow(timestamp: unknown, cutoff: number, now: number): boolean { if (!timestamp) return true; const value = new Date(String(timestamp)).getTime(); return Number.isFinite(value) && value >= cutoff && value <= now; }
function candidateIdOf(candidate: Record<string, unknown>, index: number): string { const explicit = candidate.id ?? candidate.candidateId ?? candidate.dividendEventId; if (explicit !== undefined && String(explicit).trim()) return String(explicit).trim(); return `${normalizeSymbol(String(candidate.symbol))}:${candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE'}:${index}`; }
function normalizeSymbol(symbol: string): string { return symbol.trim().toUpperCase(); }
function optionalNumber(value: unknown): number | undefined { const n = Number(value); return Number.isFinite(n) ? n : undefined; }
function round(value: number): number { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
function positive(value: unknown, fallback: number): number { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
function optionalPositive(value: unknown): number | undefined { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : undefined; }
function bounded(value: unknown, min: number, max: number, fallback: number): number { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function deduplicate(decisions: TradeDecision[]): TradeDecision[] { const seen = new Set<string>(); return decisions.filter(decision => { if (!decision.decisionId || seen.has(decision.decisionId)) return false; seen.add(decision.decisionId); return true; }); }
