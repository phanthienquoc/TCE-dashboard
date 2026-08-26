export type TceSignal = 'HOLD' | 'WATCH' | 'TAKE_PROFIT' | 'CASHOUT' | 'CUT' | 'EXIT';

export type TcePosition = {
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
};

export type TceEngineConfig = {
  takeProfitPct: number;
  cashoutPct: number;
  cutPct: number;
};

export type TceDecision = {
  symbol: string;
  signal: TceSignal;
  score: number;
  reason: Record<string, unknown>;
};

const DEFAULT_CONFIG: TceEngineConfig = {
  takeProfitPct: 5,
  cashoutPct: 8,
  cutPct: -5,
};

export class TceEngine {
  constructor(private readonly config: TceEngineConfig = DEFAULT_CONFIG) {}

  evaluate(position: TcePosition): TceDecision {
    const price = position.marketPrice == null ? undefined : Number(position.marketPrice);
    const quantity = Number(position.quantity ?? 0);
    const avg = Number(position.averagePrice ?? 0);
    const cost = avg * quantity;
    const value = price == null ? undefined : price * quantity;
    const pnl = position.unrealizedPnl ?? (value == null ? undefined : value - cost);
    const pnlPct = pnl == null || cost <= 0 ? undefined : (pnl / cost) * 100;

    let signal: TceSignal = 'WATCH';
    if (pnlPct == null) signal = 'WATCH';
    else if (pnlPct >= this.config.cashoutPct) signal = 'CASHOUT';
    else if (pnlPct >= this.config.takeProfitPct) signal = 'TAKE_PROFIT';
    else if (pnlPct <= this.config.cutPct) signal = 'CUT';
    else signal = 'HOLD';

    const score = pnlPct == null ? 0 : Math.min(100, Math.max(0, 50 + pnlPct * 5));

    return {
      symbol: position.symbol.toUpperCase(),
      signal,
      score: Number(score.toFixed(3)),
      reason: {
        pnlPct: pnlPct == null ? null : Number(pnlPct.toFixed(4)),
        thresholds: this.config,
      },
    };
  }

  evaluateMany(positions: TcePosition[]): TceDecision[] {
    return positions.map((position) => this.evaluate(position));
  }
}
