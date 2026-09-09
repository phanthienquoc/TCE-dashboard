import type { TceCandidate, TceDividendEvent } from '@tce/contracts';

export type HuntingDividendMarketSnapshot = {
  symbol: string;
  price: number;
  averageTurnover?: number;
  averageVolume?: number;
  volatility?: number;
  tradable?: boolean;
  halted?: boolean;
  abnormalEvent?: boolean;
  observedAt: string;
};

export type HuntingDividendScannerInput = {
  dividend: TceDividendEvent;
  market: HuntingDividendMarketSnapshot;
  now: string;
};

export type HuntingDividendScannerPolicy = {
  windowDays?: number;
  minTurnover?: number;
  minVolume?: number;
  maxVolatility?: number;
  minScore?: number;
  maxDataAgeMinutes?: number;
};

export class HuntingDividendCandidateScanner {
  readonly id = 'hunting_dividend_scanner';
  readonly version = '1.0.0';

  constructor(private readonly policy: HuntingDividendScannerPolicy = {}) {}

  scan(input: HuntingDividendScannerInput): TceCandidate | null {
    const { dividend, market, now } = input;
    const nowMs = Date.parse(now);
    const observedMs = Date.parse(market.observedAt);
    const exDividendMs = Date.parse(dividend.exDividendAt);
    const windowDays = Math.max(1, this.policy.windowDays ?? 30);
    const maxAgeMs = Math.max(1, this.policy.maxDataAgeMinutes ?? 30) * 60_000;

    if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(exDividendMs)) return null;
    if (!market.symbol || market.symbol.toUpperCase() !== dividend.symbol.toUpperCase()) return null;
    if (!Number.isFinite(market.price) || market.price <= 0) return null;
    if (Math.abs(nowMs - observedMs) > maxAgeMs) return null;
    if (market.tradable === false || market.halted === true || market.abnormalEvent === true) return null;
    if (exDividendMs < nowMs || exDividendMs > nowMs + windowDays * 86_400_000) return null;
    if (this.policy.minTurnover !== undefined && (market.averageTurnover ?? 0) < this.policy.minTurnover) return null;
    if (this.policy.minVolume !== undefined && (market.averageVolume ?? 0) < this.policy.minVolume) return null;
    if (this.policy.maxVolatility !== undefined && (market.volatility ?? Number.POSITIVE_INFINITY) > this.policy.maxVolatility) return null;

    const dividendYield = dividend.dividendYield ??
      (dividend.dividendValue !== undefined ? (dividend.dividendValue / market.price) * 100 : 0);
    const daysToEx = Math.max(0, Math.ceil((exDividendMs - nowMs) / 86_400_000));
    const score = scoreCandidate(dividendYield, daysToEx, market);
    const minScore = this.policy.minScore ?? 0;
    if (!Number.isFinite(score) || score < minScore) return null;

    return {
      id: `candidate:${dividend.id}:${market.symbol.toUpperCase()}:${now}`,
      symbol: market.symbol.toUpperCase(),
      dividendEventId: dividend.id,
      observedAt: market.observedAt,
      price: market.price,
      score: round(score),
      expectedReturn: round(dividendYield),
      dividendContribution: round(dividendYield),
      riskScore: round(market.volatility ?? 0),
      reasons: [
        'dividend_event_in_window',
        'market_data_fresh',
        'security_tradable',
        'candidate_scored',
      ],
      scannerVersion: this.version,
    };
  }

  scanBatch(inputs: readonly HuntingDividendScannerInput[]): TceCandidate[] {
    const seen = new Set<string>();
    const candidates: TceCandidate[] = [];

    for (const input of inputs) {
      const symbol = input.market.symbol.trim().toUpperCase();
      const dividendId = input.dividend.id.trim();
      const key = `${dividendId}:${symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const candidate = this.scan(input);
      if (candidate) candidates.push(candidate);
    }

    return candidates.sort((a, b) =>
      b.score - a.score ||
      a.symbol.localeCompare(b.symbol) ||
      a.id.localeCompare(b.id),
    );
  }
}

function scoreCandidate(dividendYield: number, daysToEx: number, market: HuntingDividendMarketSnapshot): number {
  const yieldScore = Math.max(0, Math.min(60, dividendYield * 6));
  const timingScore = Math.max(0, 25 - daysToEx);
  const liquidityScore = market.averageTurnover !== undefined ? Math.min(15, Math.max(0, Math.log10(Math.max(1, market.averageTurnover)) - 5)) : 0;
  return yieldScore + timingScore + liquidityScore;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
