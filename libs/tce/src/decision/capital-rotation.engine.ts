import type {
  CapitalPoolId,
  DecisionEngine,
  DecisionEngineContext,
  DecisionSnapshot,
  DividendEntitlementStatus,
  TradeDecision,
} from '@tce/contracts';

const POOLS: CapitalPoolId[] = ['A', 'B', 'C'];
export const CAPITAL_ROTATION_STRATEGY_VERSION = 'capital_rotation.v1';

export type CapitalRotationDecisionOptions = {
  lookbackDays?: number;
  takeProfitPercent?: number;
  maxHoldDays?: number;
  minConfidence?: number;
  invalidationPercent?: number;
  slotsPerPool?: number;
  strategyVersion?: string;
};

const DEFAULTS = {
  lookbackDays: 30,
  takeProfitPercent: 5,
  maxHoldDays: 30,
  minConfidence: 0.5,
  invalidationPercent: 0,
  slotsPerPool: 1,
};

export class CapitalRotationDecisionEngine implements DecisionEngine {
  readonly id = 'capital_rotation_decision';

  constructor(private readonly options: CapitalRotationDecisionOptions = {}) {}

  decide(context: DecisionEngineContext): TradeDecision[] {
    const cfg = resolveConfig(context.config, this.options);
    const now = new Date(context.timestamp).getTime();
    if (!Number.isFinite(now)) return [];

    const decisions = decideExistingPositions(context, cfg);
    const occupiedSymbols = new Set(context.positions.map(p => normalize(p.symbol)));
    const occupiedSlots = new Set(context.positions.map(p => p.slot));
    const candidates = context.candidates
      .map((candidate, index) => ({ candidate, index, score: candidateScore(candidate) }))
      .filter(item => item.score !== null)
      .filter(item => inWindow(item.candidate.gdkhqTimestamp, now - cfg.lookbackDays * DAY_MS, now))
      .filter(item => !occupiedSymbols.has(normalize(item.candidate.symbol)))
      .sort(
        (a, b) =>
          (b.score as number) - (a.score as number) ||
          normalize(a.candidate.symbol).localeCompare(normalize(b.candidate.symbol)) ||
          a.index - b.index
      );

    const seen = new Set<string>();
    let candidateIndex = 0;
    for (const pool of POOLS) {
      const state = context.pools.find(p => p.pool === pool);
      if (!state || !Number.isFinite(state.availableCapital) || state.availableCapital <= 0)
        continue;
      const slotCapital = state.allocatedCapital / cfg.slotsPerPool;
      if (!Number.isFinite(slotCapital) || slotCapital <= 0) continue;
      for (let slotIndex = 1; slotIndex <= cfg.slotsPerPool; slotIndex += 1) {
        const slot = `${pool}${slotIndex}`;
        if (occupiedSlots.has(slot)) continue;
        while (candidateIndex < candidates.length) {
          const item = candidates[candidateIndex++];
          const candidate = item.candidate;
          const confidence = bounded((item.score as number) / 100, 0, 1);
          const symbol = normalize(candidate.symbol);
          const candidateId = candidateIdOf(candidate, item.index);
          const lifecycleWindow = (
            candidate.exRightDate ??
            candidate.gdkhqTimestamp ??
            'NO_EVENT_DATE'
          ).slice(0, 10);
          const decisionWindowKey = `${candidateId}:${lifecycleWindow}`;
          const decisionId = `${cfg.strategyVersion}:${symbol}:BUY:${slot}:${decisionWindowKey}`;
          if (seen.has(decisionId) || confidence < cfg.minConfidence) continue;
          seen.add(decisionId);

          const entry = Number(candidate.price);
          const expectedReturn = optionalNumber(candidate.expectedReturn) ?? 0;
          const target =
            optionalNumber(candidate.targetPrice) ??
            round(entry * (1 + cfg.takeProfitPercent / 100));
          const invalidation =
            cfg.invalidationPercent > 0
              ? round(entry * (1 - cfg.invalidationPercent / 100))
              : undefined;
          const allocation = Math.min(slotCapital, state.availableCapital);
          if (
            !Number.isFinite(entry) ||
            entry <= 0 ||
            !Number.isFinite(target) ||
            target <= entry ||
            allocation <= 0
          )
            continue;
          if (
            invalidation !== undefined &&
            (!Number.isFinite(invalidation) || invalidation <= 0 || invalidation >= entry)
          )
            continue;

          decisions.push({
            engine: this.id,
            decision: 'BUY',
            symbol,
            pool,
            slot,
            capital: allocation,
            maxPrice: entry,
            entry,
            target,
            invalidation,
            tpPercent: cfg.takeProfitPercent,
            maxHoldDays: cfg.maxHoldDays,
            confidence,
            dividendNet: optionalNumber(candidate.dividendNet),
            candidateId,
            decisionWindowKey,
            decisionId,
            strategyVersion: cfg.strategyVersion,
            reasons: [
              'candidate_ranked',
              'confidence_above_threshold',
              'slot_available',
              'capital_available',
              expectedReturn > 0 ? 'return_signal_present' : 'return_signal_missing',
            ],
            timestamp: context.timestamp,
          });
          break;
        }
      }
    }

    return deduplicate(decisions);
  }

  snapshot(decision: TradeDecision): DecisionSnapshot {
    const decisionId =
      decision.decisionId ??
      `${decision.strategyVersion ?? CAPITAL_ROTATION_STRATEGY_VERSION}:${decision.symbol ?? 'UNKNOWN'}:${decision.decision}:${decision.slot ?? 'UNASSIGNED'}:${decision.timestamp}`;
    const strategyVersion = decision.strategyVersion ?? CAPITAL_ROTATION_STRATEGY_VERSION;
    return { decisionId, strategyVersion, decision: { ...decision, decisionId, strategyVersion } };
  }
}

function resolveConfig(
  config: Record<string, unknown> | undefined,
  options: CapitalRotationDecisionOptions
) {
  const source = { ...(config ?? {}), ...options };
  return {
    lookbackDays: positive(source.lookbackDays, DEFAULTS.lookbackDays),
    takeProfitPercent: positive(
      source.takeProfitPercent ?? source.tpPercent,
      DEFAULTS.takeProfitPercent
    ),
    invalidationPercent: positive(source.invalidationPercent, DEFAULTS.invalidationPercent),
    maxHoldDays: positive(source.maxHoldDays, DEFAULTS.maxHoldDays),
    minConfidence: bounded(source.minConfidence, 0, 1, DEFAULTS.minConfidence),
    slotsPerPool: Math.max(1, Math.floor(positive(source.slotsPerPool, DEFAULTS.slotsPerPool))),
    strategyVersion: String(source.strategyVersion ?? CAPITAL_ROTATION_STRATEGY_VERSION),
  };
}

function decideExistingPositions(
  context: DecisionEngineContext,
  cfg: ReturnType<typeof resolveConfig>
): TradeDecision[] {
  return context.positions.map(position => {
    const symbol = normalize(position.symbol);
    const entry = optionalNumber(position.entryPrice);
    const current = optionalNumber(position.currentPrice);
    const target = optionalNumber(position.targetPrice);
    const profitNet =
      entry !== undefined &&
      current !== undefined &&
      Number.isFinite(position.quantity) &&
      position.quantity > 0
        ? (current - entry) * position.quantity
        : undefined;

    const decisionId = `${cfg.strategyVersion}:${symbol}:POSITION:${position.slot}:${position.exRightDate ?? position.recordDate ?? 'NO_EVENT_DATE'}`;
    const entitlement = resolveEntitlement(position, context.timestamp);
    const common = {
      engine: 'capital_rotation_decision',
      symbol,
      pool: position.pool,
      slot: position.slot,
      confidence: 1,
      profitNet,
      dividendNet: optionalNumber(position.dividendNet),
      candidateId: undefined,
      decisionWindowKey: String(
        position.exRightDate ?? position.recordDate ?? 'NO_EVENT_DATE'
      ).slice(0, 10),
      decisionId,
      strategyVersion: cfg.strategyVersion,
      timestamp: context.timestamp,
    };

    if (entitlement === 'AT_RISK') {
      return { ...common, decision: 'HOLD', reasons: ['protect_dividend_entitlement'] };
    }

    if (target !== undefined && current !== undefined && current >= target) {
      return {
        ...common,
        decision: 'SELL',
        reasons: ['target_reached', 'capital_recycling_ready'],
      };
    }

    if (
      entry !== undefined &&
      current !== undefined &&
      entry > 0 &&
      current <= entry * (1 - cfg.invalidationPercent / 100)
    ) {
      return {
        ...common,
        decision: 'SELL',
        reasons: ['price_invalidation', 'capital_recycling_guard'],
      };
    }

    if (optionalNumber(position.dividendNet) !== undefined && Number.isFinite(profitNet)) {
      const dividendNet = optionalNumber(position.dividendNet) as number;
      if (profitNet !== undefined && profitNet > dividendNet) {
        return {
          ...common,
          decision: 'SELL',
          reasons: ['profit_net_exceeds_expected_dividend', 'capital_recycling_ready'],
        };
      }
    }

    if (entitlement === 'UNKNOWN') {
      return { ...common, decision: 'WAIT', reasons: ['dividend_entitlement_unknown'] };
    }

    return {
      ...common,
      decision: entitlement === 'PROTECTED' || entitlement === 'CONFIRMED' ? 'HOLD' : 'WAIT',
      reasons:
        entitlement === 'PROTECTED' || entitlement === 'CONFIRMED'
          ? ['position_within_rotation_window']
          : ['await_dividend_entitlement'],
    };
  });
}

function candidateScore(candidate: Record<string, unknown>): number | null {
  const price = Number(candidate.price);
  if (!candidate.symbol || !Number.isFinite(price) || price <= 0) return null;

  const explicit = Number(candidate.score);
  if (Number.isFinite(explicit)) return explicit;

  const dividendYield = Number(candidate.dividendYieldPct ?? candidate.dividendRatio ?? 0);
  const expectedReturn = Number(candidate.expectedReturn ?? 0);
  const recovery = Number(candidate.recoveryScore ?? 0);
  const liquidity = Number(candidate.liquidityScore ?? 0);
  const risk = Number(candidate.riskScore ?? 0);
  const score =
    dividendYield * 5 + expectedReturn * 3 + recovery * 1 + liquidity * 0.5 - risk * 0.5;
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

function resolveEntitlement(
  position: Record<string, unknown>,
  timestamp: string
): DividendEntitlementStatus {
  if (position.entitlementStatus) return position.entitlementStatus as DividendEntitlementStatus;
  if (!position.exRightDate && !position.sellableAt) return 'UNKNOWN';
  const exDate = position.exRightDate
    ? new Date(String(position.exRightDate)).getTime()
    : Number.NaN;
  const now = new Date(timestamp).getTime();
  if (Number.isFinite(exDate) && now < exDate) return 'AT_RISK';
  if (position.sellableAt && now < new Date(String(position.sellableAt)).getTime())
    return 'PROTECTED';
  if (Number.isFinite(exDate) && now >= exDate) return 'PROTECTED';
  return 'UNKNOWN';
}

function candidateIdOf(candidate: Record<string, unknown>, index: number): string {
  const explicit = candidate.id ?? candidate.candidateId ?? candidate.dividendEventId;
  if (explicit !== undefined && String(explicit).trim()) return String(explicit).trim();
  return `${normalize(String(candidate.symbol))}:${candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE'}:${index}`;
}
function normalize(value: string): string {
  return value.trim().toUpperCase();
}
function optionalNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function bounded(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function inWindow(timestamp: unknown, cutoff: number, now: number): boolean {
  if (!timestamp) return true;
  const value = new Date(String(timestamp)).getTime();
  return Number.isFinite(value) && value >= cutoff && value <= now;
}
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
function deduplicate(decisions: TradeDecision[]): TradeDecision[] {
  const seen = new Set<string>();
  return decisions.filter(decision => {
    if (!decision.decisionId || seen.has(decision.decisionId)) return false;
    seen.add(decision.decisionId);
    return true;
  });
}
