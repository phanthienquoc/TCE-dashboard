import type {
  DecisionEngine,
  DecisionEngineContext,
  DecisionStockCandidate,
  TradeDecision,
} from '@tce/contracts';

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
  invalidationPercent: 5,
  maxHoldDays: 30,
  minConfidence: 0.5,
  slotsPerPool: 1,
};

export class CapitalRotationDecisionEngine implements DecisionEngine {
  readonly id = 'capital_rotation_decision';

  constructor(private readonly options: CapitalRotationDecisionOptions = {}) {}

  decide(context: DecisionEngineContext): TradeDecision[] {
    const cfg = resolveConfig(context.config, this.options);
    const nowMs = Date.parse(context.timestamp);
    if (!Number.isFinite(nowMs)) return [];

    const occupiedSymbols = new Set(context.positions.map(position => normalize(position.symbol)));
    const occupiedSlots = new Set(context.positions.map(position => position.slot));

    const decisions = decideExistingPositions(context, cfg);
    const candidates = context.candidates
      .map((candidate, index) => ({ candidate, index, score: candidateScore(candidate) }))
      .filter(item => item.score !== null)
      .filter(item => inLookback(item.candidate, nowMs, cfg.lookbackDays))
      .filter(item => !occupiedSymbols.has(normalize(item.candidate.symbol)))
      .sort(
        (a, b) =>
          (b.score as number) - (a.score as number) ||
          normalize(a.candidate.symbol).localeCompare(normalize(b.candidate.symbol)) ||
          a.index - b.index
      );

    let candidateIndex = 0;
    const seen = new Set<string>();

    for (const pool of context.pools) {
      if (!Number.isFinite(pool.availableCapital) || pool.availableCapital <= 0) continue;
      const slotCapital = pool.allocatedCapital > 0 ? pool.allocatedCapital / cfg.slotsPerPool : pool.availableCapital / cfg.slotsPerPool;
      if (!Number.isFinite(slotCapital) || slotCapital <= 0) continue;

      for (let slotIndex = 1; slotIndex <= cfg.slotsPerPool; slotIndex += 1) {
        const slot = `${pool.pool}${slotIndex}`;
        if (occupiedSlots.has(slot)) continue;

        while (candidateIndex < candidates.length) {
          const item = candidates[candidateIndex++];
          const candidate = item.candidate;
          const confidence = normalizedConfidence(item.score as number);
          if (confidence < cfg.minConfidence) continue;

          const entry = Number(candidate.price);
          if (!Number.isFinite(entry) || entry <= 0) continue;

          const expectedReturn = Number(candidate.expectedReturn ?? candidate.dividendValue ?? 0);
          const target = round(entry * (1 + cfg.takeProfitPercent / 100));
          const allocation = Math.min(slotCapital, pool.availableCapital);
          const symbol = normalize(candidate.symbol);
          const candidateId = candidateIdOf(candidate, item.index);
          const windowKey = String(candidate.exRightDate ?? candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE').slice(0, 10);
          const decisionId = `${cfg.strategyVersion}:${symbol}:BUY:${slot}:${candidateId}:${windowKey}`;

          if (seen.has(decisionId)) continue;
          seen.add(decisionId);

          if (!Number.isFinite(target) || target <= entry || allocation <= 0) continue;

          decisions.push({
            engine: this.id,
            decision: 'BUY',
            symbol,
            pool: pool.pool,
            slot,
            capital: allocation,
            maxPrice: entry,
            entry,
            target,
            tpPercent: cfg.takeProfitPercent,
            maxHoldDays: cfg.maxHoldDays,
            confidence,
            dividendNet: optionalNumber(candidate.dividendNet),
            candidateId,
            decisionWindowKey: windowKey,
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
}

function resolveConfig(
  config: Record<string, unknown> | undefined,
  options: CapitalRotationDecisionOptions
) {
  const source = { ...(config ?? {}), ...options };
  return {
    lookbackDays: positive(source.lookbackDays, DEFAULTS.lookbackDays),
    takeProfitPercent: positive(source.takeProfitPercent ?? source.tpPercent, DEFAULTS.takeProfitPercent),
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
      entry !== undefined && current !== undefined && Number.isFinite(position.quantity) && position.quantity > 0
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
      decisionWindowKey: String(position.exRightDate ?? position.recordDate ?? 'NO_EVENT_DATE').slice(0, 10),
      decisionId,
      strategyVersion: cfg.strategyVersion,
      timestamp: context.timestamp,
    };

    if (entitlement === 'UNKNOWN') {
      return { ...common, decision: 'WAIT', reasons: ['dividend_entitlement_unknown'] };
    }
    if (entitlement === 'AT_RISK') {
      return { ...common, decision: 'HOLD', reasons: ['protect_dividend_entitlement'] };
    }

    if (entitlement === 'UNKNOWN' && target !== undefined && current !== undefined && current >= target) {
      return { ...common, decision: 'SELL', reasons: ['target_reached', 'capital_recycling_ready'] };
    }

    if (target !== undefined && current !== undefined && current >= target) {
      return { ...common, decision: 'SELL', reasons: ['target_reached', 'capital_recycling_ready'] };
    }

    if (entry !== undefined && current !== undefined && entry > 0 && current <= entry * (1 - cfg.invalidationPercent / 100)) {
      return { ...common, decision: 'SELL', reasons: ['price_invalidation', 'capital_recycling_guard'] };
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

    return {
      ...common,
      decision: entitlement === 'PROTECTED' || entitlement === 'CONFIRMED' ? 'HOLD' : 'WAIT',
      reasons: entitlement === 'PROTECTED' || entitlement === 'CONFIRMED' ? ['position_within_rotation_window'] : ['await_dividend_entitlement'],
    };
  });
}

function candidateScore(candidate: DecisionStockCandidate): number | null {
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
    (Number.isFinite(dividendYield) ? dividendYield * 4 : 0) +
    (Number.isFinite(expectedReturn) ? expectedReturn * 10 : 0) +
    (Number.isFinite(recovery) ? recovery : 0) +
    (Number.isFinite(liquidity) ? liquidity : 0) -
    (Number.isFinite(risk) ? risk : 0);

  return Number.isFinite(score) ? score : null;
}

function inLookback(candidate: DecisionStockCandidate, nowMs: number, lookbackDays: number): boolean {
  const raw = candidate.gdkhqTimestamp ?? candidate.exRightDate;
  if (!raw) return true;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) && timestamp >= nowMs - lookbackDays * DAY_MS && timestamp <= nowMs;
}

function candidateIdOf(candidate: DecisionStockCandidate, index: number): string {
  const explicit = candidate.id ?? candidate.candidateId ?? candidate.dividendEventId;
  return explicit !== undefined && String(explicit).trim()
    ? String(explicit).trim()
    : `${normalize(candidate.symbol)}:${candidate.gdkhqTimestamp ?? 'NO_EVENT_DATE'}:${index}`;
}

function normalizedConfidence(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
}

function optionalNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function positive(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function bounded(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function deduplicate(decisions: TradeDecision[]): TradeDecision[] {
  const seen = new Set<string>();
  return decisions.filter(decision => {
    if (!decision.decisionId || seen.has(decision.decisionId)) return false;
    seen.add(decision.decisionId);
    return true;
  });
}

const DAY_MS = 86_400_000;


function resolveEntitlement(position: DecisionEngineContext['positions'][number], timestamp: string): 'UNKNOWN' | 'AT_RISK' | 'PROTECTED' | 'CONFIRMED' {
  if (position.entitlementStatus === 'CONFIRMED' || position.entitlementStatus === 'PROTECTED') return position.entitlementStatus;
  if (position.entitlementStatus === 'AT_RISK') return 'AT_RISK';
  const raw = position.exRightDate ?? position.recordDate;
  if (!raw) return 'UNKNOWN';
  const exDate = Date.parse(raw);
  const now = Date.parse(timestamp);
  if (!Number.isFinite(exDate) || !Number.isFinite(now)) return 'UNKNOWN';
  return now < exDate ? 'AT_RISK' : 'PROTECTED';
}
