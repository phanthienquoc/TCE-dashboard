import type { DecisionStockCandidate } from '@tce/contracts';

export const CAPITAL_ROTATION_POOL_VERSION = 'capital_rotation_pool.v1';

export type CapitalRotationPoolPolicy = {
  size?: number;
  lookbackDays?: number;
  maxDataAgeMinutes?: number;
  minPrice?: number;
  minTurnover?: number;
  minVolume?: number;
};

export type CapitalRotationPoolCandidate = DecisionStockCandidate & {
  poolScore: number;
  dividendScore: number;
  liquidityScore: number;
  recoveryScore: number;
  riskScore: number;
  turnoverScore: number;
  catalystScore: number;
  expectedReturnPct: number;
  expectedHoldDays: number;
  poolReason: string[];
};

const DEFAULTS = {
  size: 20,
  lookbackDays: 30,
  maxDataAgeMinutes: 120,
  minPrice: 5,
  minTurnover: 1_000_000,
  minVolume: 10_000,
};

export class CapitalRotationPoolScorer {
  readonly version = CAPITAL_ROTATION_POOL_VERSION;

  constructor(private readonly policy: CapitalRotationPoolPolicy = {}) {}

  rank(candidates: readonly DecisionStockCandidate[], now: string): CapitalRotationPoolCandidate[] {
    const cfg = resolvePolicy(this.policy);
    const nowMs = Date.parse(now);
    if (!Number.isFinite(nowMs)) return [];

    const deduped = new Map<string, CapitalRotationPoolCandidate>();

    for (const candidate of candidates) {
      const scored = scoreCandidate(candidate, nowMs, cfg);
      if (!scored) continue;

      const key = eventKey(candidate);
      const existing = deduped.get(key);
      if (!existing || scored.poolScore > existing.poolScore) {
        deduped.set(key, scored);
      }
    }

    return [...deduped.values()]
      .sort(
        (a, b) =>
          b.poolScore - a.poolScore ||
          a.expectedHoldDays - b.expectedHoldDays ||
          normalize(a.symbol).localeCompare(normalize(b.symbol)),
      )
      .slice(0, cfg.size)
      .map((candidate, index) => ({
        ...candidate,
        poolRank: index + 1,
      })) as CapitalRotationPoolCandidate[];
  }
}

type ResolvedPolicy = Required<CapitalRotationPoolPolicy>;

function resolvePolicy(policy: CapitalRotationPoolPolicy): ResolvedPolicy {
  return {
    size: Math.max(1, Math.min(20, Math.trunc(numberOr(policy.size, DEFAULTS.size)))),
    lookbackDays: Math.max(1, numberOr(policy.lookbackDays, DEFAULTS.lookbackDays)),
    maxDataAgeMinutes: Math.max(1, numberOr(policy.maxDataAgeMinutes, DEFAULTS.maxDataAgeMinutes)),
    minPrice: Math.max(0.01, numberOr(policy.minPrice, DEFAULTS.minPrice)),
    minTurnover: Math.max(0, numberOr(policy.minTurnover, DEFAULTS.minTurnover)),
    minVolume: Math.max(0, numberOr(policy.minVolume, DEFAULTS.minVolume)),
  };
}

function scoreCandidate(
  candidate: DecisionStockCandidate,
  nowMs: number,
  cfg: ResolvedPolicy,
): CapitalRotationPoolCandidate | null {
  const symbol = normalize(candidate.symbol);
  const price = numberOr(candidate.price, Number.NaN);
  if (!symbol || !Number.isFinite(price) || price < cfg.minPrice) return null;

  const observedRaw = String(candidate.observedAt ?? candidate.currentPriceDate ?? candidate.gdkhqTimestamp ?? '');
  const observedMs = observedRaw ? Date.parse(observedRaw) : Number.NaN;
  if (Number.isFinite(observedMs) && nowMs - observedMs > cfg.maxDataAgeMinutes * 60_000) return null;

  const turnover = numberOr(candidate.averageTurnover ?? candidate.turnover, 0);
  const volume = numberOr(candidate.averageVolume ?? candidate.volume, 0);
  if (turnover < cfg.minTurnover || volume < cfg.minVolume) return null;

  const eventType = String(candidate.dividendType ?? candidate.eventType ?? 'CASH').toUpperCase();
  if (eventType !== 'CASH') return null;

  const yieldPct = positiveNumber(candidate.dividendYieldPct ?? candidate.dividendRatio ?? candidate.dividendValue, 0, price);
  const recoveryPct = bounded(numberOr(candidate.recoveryScore, recoveryFromRange(candidate)), 0, 15);
  const liquidityScore = bounded(liquidityFromTurnover(turnover), 0, 15);
  const turnoverScore = bounded(liquidityFromTurnover(turnover) * 0.5, 0, 5);
  const riskScore = bounded(numberOr(candidate.riskScore ?? candidate.volatility, 0), 0, 10);
  const catalystScore = bounded(eventProximityScore(candidate, nowMs), 0, 10);
  const dividendScore = bounded(yieldPct * 2, 0, 20);
  const expectedReturnPct = Math.max(0, bounded(numberOr(candidate.expectedReturn, yieldPct), 0, 20));
  const expectedHoldDays = holdDays(candidate, nowMs);
  const poolScore = bounded(
    dividendScore +
      bounded(numberOr(candidate.dividendQualityScore, 0), 0, 15) +
      liquidityScore +
      recoveryPct +
      bounded(numberOr(candidate.momentumScore, 0), 0, 10) +
      catalystScore +
      (10 - riskScore) +
      turnoverScore,
    0,
    100,
  );

  return {
    ...candidate,
    symbol,
    poolScore: round(poolScore),
    dividendScore: round(dividendScore),
    liquidityScore: round(liquidityScore),
    recoveryScore: round(recoveryPct),
    riskScore: round(riskScore),
    turnoverScore: round(turnoverScore),
    catalystScore: round(catalystScore),
    expectedReturnPct: round(expectedReturnPct),
    expectedHoldDays,
    poolReason: [
      'cash_dividend',
      'market_data_fresh',
      'liquidity_gate_passed',
      'recovery_signal',
      expectedHoldDays <= 7 ? 'short_turnover_window' : 'rotation_window',
    ],
  };
}

function recoveryFromRange(candidate: DecisionStockCandidate): number {
  const low = numberOr(candidate.oneYearLow, Number.NaN);
  const high = numberOr(candidate.oneYearHigh, Number.NaN);
  const price = numberOr(candidate.price, Number.NaN);
  if (![low, high, price].every(Number.isFinite) || high <= low) return 0;
  const position = (price - low) / (high - low);
  return bounded((1 - Math.abs(0.5 - position) * 2) * 15, 0, 15);
}

function liquidityFromTurnover(turnover: number): number {
  if (!Number.isFinite(turnover) || turnover <= 0) return 0;
  return bounded(Math.log10(Math.max(1, turnover)) - 5, 0, 15);
}

function eventProximityScore(candidate: DecisionStockCandidate, nowMs: number): number {
  const raw = candidate.exRightDate ?? candidate.gdkhqTimestamp;
  if (!raw) return 0;
  const exMs = Date.parse(String(raw));
  if (!Number.isFinite(exMs)) return 0;
  const days = Math.max(0, Math.ceil((exMs - nowMs) / 86_400_000));
  return Math.max(0, 10 - Math.min(days, 10));
}

function holdDays(candidate: DecisionStockCandidate, nowMs: number): number {
  const raw = candidate.exRightDate ?? candidate.paymentDate ?? candidate.gdkhqTimestamp;
  if (!raw) return 7;
  const eventMs = Date.parse(String(raw));
  if (!Number.isFinite(eventMs)) return 7;
  return Math.max(1, Math.min(30, Math.ceil(Math.abs(eventMs - nowMs) / 86_400_000)));
}

function eventKey(candidate: DecisionStockCandidate): string {
  return [
    normalize(candidate.symbol),
    String(candidate.dividendEventId ?? candidate.eventId ?? ''),
    String(candidate.exRightDate ?? candidate.gdkhqTimestamp ?? ''),
  ].join(':');
}

function positiveNumber(value: unknown, fallback: number, price: number): number {
  const direct = Number(value);
  if (Number.isFinite(direct)) {
    const ratioText = String(value);
    if (ratioText.includes('%')) return Math.max(0, direct);
    if (direct > 0 && direct < 1) return direct * 100;
    if (direct > 20 && price > 0) return (direct / price) * 100;
    return Math.max(0, direct);
  }
  return fallback;
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bounded(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}
