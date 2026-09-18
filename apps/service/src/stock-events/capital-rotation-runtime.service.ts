import { Injectable } from '@nestjs/common';
import type {
  DecisionEngineContext,
  DecisionPositionState,
  DecisionStockCandidate,
  DecisionPoolState,
} from '@tce/contracts';
import { CapitalRotationDecisionEngine } from '@tce/tce';
import { SupabaseClientService } from '../db/supabase.client';
import { StockDividendPoolService } from './stock-dividend-pool.service';

@Injectable()
export class CapitalRotationRuntimeService {
  private readonly engine = new CapitalRotationDecisionEngine();

  constructor(
    private readonly db: SupabaseClientService,
    private readonly pool: StockDividendPoolService,
  ) {}

  async evaluateAccount(userId: string, accountId: string, now = new Date().toISOString()) {
    const [poolRows, positionRows, account, strategy] = await Promise.all([
      this.pool.getTop(20),
      this.loadPositions(accountId),
      this.loadAccount(accountId),
      this.loadStrategy(accountId),
    ]);

    const symbols = poolRows.map(row => String(row.ticker).toUpperCase()).filter(Boolean);
    const candidateRows = poolRows.map(row => ({
      symbol: String(row.ticker).toUpperCase(),
      price: Number(row.currentPrice ?? row.price ?? 0),
      dividendValue: Number(row.dividendValue ?? 0),
      dividendRatio: row.dividendRate ?? undefined,
      dividendNet: Number(row.dividendValue ?? 0) * 0.95,
      gdkhqTimestamp: row.exDividendTimestamp ?? undefined,
      exRightDate: row.exDividendDate ?? undefined,
      paymentDate: row.paymentDate ?? undefined,
      realPnl: 0,
      realPnlNet: 0,
      score: Number(row.score ?? 0),
      dividendYieldPct: Number(row.dividendYieldPct ?? 0),
      recoveryScore: Number(row.recoveryScore ?? 0),
      liquidityScore: Number(row.liquidityScore ?? 0),
      riskScore: Number(row.riskScore ?? 0),
      expectedReturn: Number(row.expectedReturnPct ?? 0),
      observedAt: row.currentPriceDate ?? now,
      dividendEventId: row.id,
    })) satisfies DecisionStockCandidate[];

    const positionStates = positionRows.map(position => ({
      symbol: String(position.symbol).toUpperCase(),
      pool: poolForPosition(position.symbol, strategy?.pool_size),
      slot: 'A1',
      quantity: Number(position.quantity ?? 0),
      entryPrice: position.avg_cost == null ? undefined : Number(position.avg_cost),
      currentPrice: position.market_price == null ? undefined : Number(position.market_price),
      targetPrice: undefined,
      dividendGross: undefined,
      dividendNet: undefined,
      exRightDate: undefined,
      recordDate: undefined,
      paymentDate: undefined,
      entitlementStatus: undefined,
      sellableAt: undefined,
      status: position.status ?? undefined,
    })) satisfies DecisionPositionState[];

    const capitalTotal = Number(account?.initial_capital ?? account?.capital_available ?? 0);
    const availableCash = Number(account?.capital_available ?? 0);
    const activeValue = positionRows.reduce(
      (sum, position) => sum + Number(position.market_value ?? 0),
      0,
    );

    const context: DecisionEngineContext = {
      timestamp: now,
      candidates: candidateRows.filter(candidate => symbols.includes(candidate.symbol)),
      capital: {
        totalCapital: capitalTotal,
        availableCash,
        pendingCash: 0,
        stockSellableValue: activeValue,
        stockPendingT2Value: 0,
      },
      pools: buildPools(strategy, availableCash, positionStates),
      positions: positionStates,
      config: {
        strategyVersion: 'capital_rotation.v1',
        lookbackDays: 30,
        takeProfitPercent: Number(strategy?.profit_target_pct ?? 5),
        invalidationPercent: 5,
        maxHoldDays: 30,
        minConfidence: 0.5,
        slotsPerPool: 1,
      },
    };

    const decisions = this.engine.decide(context);
    const persisted = await this.persistDecisionSnapshots(
      userId,
      accountId,
      decisions,
      poolRows,
      now,
    );

    return {
      candidates: context.candidates.length,
      decisions: decisions.length,
      persistedSnapshots: persisted,
      buyDecisions: decisions.filter(decision => decision.decision === 'BUY').length,
      sellDecisions: decisions.filter(decision => decision.decision === 'SELL').length,
      holdDecisions: decisions.filter(
        decision => decision.decision === 'HOLD' || decision.decision === 'WAIT',
      ).length,
      symbols: decisions.map(decision => decision.symbol).filter(Boolean),
    };
  }

  private async loadPositions(accountId: string) {
    const { data, error } = await this.db.db
      .from('tce_positions')
      .select('id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no')
      .eq('account_id', accountId)
      .neq('status', 'CLOSED')
      .order('symbol');
    if (error) throw error;
    return data ?? [];
  }

  private async loadAccount(accountId: string) {
    const { data, error } = await this.db.db
      .from('tce_accounts')
      .select('id,initial_capital,capital_available')
      .eq('id', accountId)
      .single();
    if (error) throw error;
    return data;
  }

  private async loadStrategy(accountId: string) {
    const { data, error } = await this.db.db
      .from('tce_strategy_config')
      .select('pool_size,core_capital,burst_capital,max_positions,profit_target_pct,max_asset_allocation_pct,buy_quantity_step,monitor_interval_minutes')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  private async persistDecisionSnapshots(
    userId: string,
    accountId: string,
    decisions: readonly any[],
    poolRows: readonly any[],
    snapshotAt: string,
  ) {
    if (!decisions.length) return 0;

    const poolBySymbol = new Map(
      poolRows.map(row => [String(row.ticker).toUpperCase(), row]),
    );
    const rows = decisions.map(decision => {
      const poolRow = poolBySymbol.get(String(decision.symbol ?? '').toUpperCase());
      const dividendNet = Number(decision.dividendNet ?? poolRow?.dividendValue ?? 0);
      const profitNet = Number(decision.profitNet ?? 0);
      return {
        account_id: accountId,
        decision_id: String(decision.decisionId),
        strategy_version: String(decision.strategyVersion ?? 'capital_rotation.v1'),
        symbol: String(decision.symbol ?? '').toUpperCase(),
        decision: String(decision.decision),
        candidate_id: decision.candidateId ? String(decision.candidateId) : null,
        pool: decision.pool ? String(decision.pool) : null,
        slot: decision.slot ? String(decision.slot) : null,
        entry: decision.entry ?? null,
        target: decision.target ?? null,
        confidence: decision.confidence ?? null,
        expected_dividend_per_share: poolRow?.dividendValue ?? null,
        expected_net_dividend: dividendNet || null,
        net_unrealized_profit: profitNet || null,
        profit_dividend_ratio:
          dividendNet > 0 ? profitNet / dividendNet : null,
        ex_date: poolRow?.exDividendDate ?? null,
        record_date: null,
        payment_date: poolRow?.paymentDate ?? null,
        entitlement_secured:
          decision.entitlementStatus === 'PROTECTED' ||
          decision.entitlementStatus === 'CONFIRMED',
        reasons: decision.reasons ?? [],
        agent_note:
          'CRDE runtime decision; execution remains guarded by Risk/Safety Gate.',
        snapshot_at: snapshotAt,
      };
    });

    const { data, error } = await this.db.db
      .from('tce_dividend_decision_snapshots')
      .upsert(rows, { onConflict: 'decision_id' })
      .select('id');

    if (error) throw error;
    void userId;
    return data?.length ?? rows.length;
  }
}

function buildPools(
  strategy: Record<string, any> | null,
  availableCash: number,
  positions: readonly DecisionPositionState[],
): DecisionPoolState[] {
  const configured = Number(strategy?.core_capital ?? availableCash);
  const coreA = Math.min(configured * 0.5333, availableCash);
  const coreB = Math.min(configured * 0.4667, Math.max(0, availableCash - coreA));
  return [
    {
      pool: 'A',
      allocatedCapital: coreA,
      availableCapital: Math.max(0, coreA - occupiedCapital('A', positions)),
      pendingT2Capital: 0,
      occupiedSlots: positions.filter(position => position.pool === 'A').length,
      totalSlots: 1,
    },
    {
      pool: 'B',
      allocatedCapital: coreB,
      availableCapital: Math.max(0, coreB - occupiedCapital('B', positions)),
      pendingT2Capital: 0,
      occupiedSlots: positions.filter(position => position.pool === 'B').length,
      totalSlots: 1,
    },
    {
      pool: 'C',
      allocatedCapital: 0,
      availableCapital: 0,
      pendingT2Capital: 0,
      occupiedSlots: positions.filter(position => position.pool === 'C').length,
      totalSlots: 0,
    },
  ];
}

function occupiedCapital(pool: string, positions: readonly DecisionPositionState[]) {
  return positions
    .filter(position => position.pool === pool)
    .reduce(
      (sum, position) =>
        sum + Number(position.currentPrice ?? position.entryPrice ?? 0) * position.quantity,
      0,
    );
}

function poolForPosition(symbol: string, poolSize?: number): DecisionPoolState['pool'] {
  void symbol;
  void poolSize;
  return 'A';
}
