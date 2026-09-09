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

export type HuntingDividendScanRejectionReason =
  | 'invalid_timestamp'
  | 'symbol_mismatch'
  | 'invalid_price'
  | 'stale_market_data'
  | 'not_tradable'
  | 'halted'
  | 'abnormal_event'
  | 'outside_dividend_window'
  | 'insufficient_turnover'
  | 'insufficient_volume'
  | 'excessive_volatility'
  | 'invalid_score';

export type HuntingDividendScanResult = {
  candidate: TceCandidate | null;
  rejectionReasons: readonly HuntingDividendScanRejectionReason[];
};

export class HuntingDividendCandidateScanner {
  readonly id = 'hunting_dividend_scanner';
  readonly version = '1.0.0';

  constructor(private readonly policy: HuntingDividendScannerPolicy = {}) {}

  scan(input: HuntingDividendScannerInput): TceCandidate | null {
    return this.scanDetailed(input).candidate;
  }

  scanDetailed(input: HuntingDividendScannerInput): HuntingDividendScanResult {
    const { dividend, market, now } = input;
    const nowMs = Date.parse(now);
    const observedMs = Date.parse(market.observedAt);
    const exDividendMs = Date.parse(dividend.exDividendAt);
    const windowDays = Math.max(1, this.policy.windowDays ?? 30);
    const maxAgeMs = Math.max(1, this.policy.maxDataAgeMinutes ?? 30) * 60_000;
    const rejectionReasons: HuntingDividendScanRejectionReason[] = [];

    if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(exDividendMs)) {
      rejectionReasons.push('invalid_timestamp');
    }
    if (!market.symbol || market.symbol.toUpperCase() !== dividend.symbol.toUpperCase()) {
      rejectionReasons.push('symbol_mismatch');
    }
    if (!Number.isFinite(market.price) || market.price <= 0) {
      rejectionReasons.push('invalid_price');
    }

    if (Number.isFinite(nowMs) && Number.isFinite(observedMs) && Math.abs(nowMs - observedMs) > maxAgeMs) {
      rejectionReasons.push('stale_market_data');
    }
    if (market.tradable === false) rejectionReasons.push('not_tradable');
    if (market.halted === true) rejectionReasons.push('halted');
    if (market.abnormalEvent === true) rejectionReasons.push('abnormal_event');

    if (Number.isFinite(nowMs) && Number.isFinite(exDividendMs)) {
      if (exDividendMs < nowMs || exDividendMs > nowMs + windowDays * 86_400_000) {
        rejectionReasons.push('outside_dividend_window');
      }
    }
    if (this.policy.minTurnover !== undefined && (market.averageTurnover ?? 0) < this.policy.minTurnover) {
      rejectionReasons.push('insufficient_turnover');
    }
    if (this.policy.minVolume !== undefined && (market.averageVolume ?? 0) < this.policy.minVolume) {
      rejectionReasons.push('insufficient_volume');
    }
    if (this.policy.maxVolatility !== undefined && (market.volatility ?? Number.POSITIVE_INFINITY) > this.policy.maxVolatility) {
      rejectionReasons.push('excessive_volatility');
    }

    if (rejectionReasons.length > 0) {
      return { candidate: null, rejectionReasons };
    }

    const dividendYield = dividend.dividendYield ??
      (dividend.dividendValue !== undefined ? (dividend.dividendValue / market.price) * 100 : 0);
    const daysToEx = Math.max(0, Math.ceil((exDividendMs - nowMs) / 86_400_000));
    const score = scoreCandidate(dividendYield, daysToEx, market);
    const minScore = this.policy.minScore ?? 0;
    if (!Number.isFinite(score) || score < minScore) {
      return { candidate: null, rejectionReasons: ['invalid_score'] };
    }

    return {
      candidate: {
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
      },
      rejectionReasons: [],
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
