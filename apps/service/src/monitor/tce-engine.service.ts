import { Injectable, Logger } from '@nestjs/common';
import {
  TceEngineAccountState,
  TceEngineCandidate,
  TceEngineConfig,
  TceEngineDecision,
} from '@tce/contracts';
import { tceEngine } from '@tce/tce-engine';
import { SupabaseClientService } from '../db/supabase.client';

const DEFAULT_CONFIG: TceEngineConfig = {
  enabled: false,
  profitTargetPct: 10,
  maxTotalAssets: 5,
  maxAssetAllocationPct: 40,
  buyQuantityStep: 100,
  buyFromRemainingBudget: true,
};

@Injectable()
export class TceEngineService {
  private readonly logger = new Logger(TceEngineService.name);
  private running = new Set<string>();

  constructor(private readonly supabase: SupabaseClientService) {}

  async run(accountId: string, environment = 'production', execute = false) {
    if (this.running.has(accountId))
      return { skipped: true, reason: 'already_running', decisions: [] as TceEngineDecision[] };
    this.running.add(accountId);
    try {
      const config = await this.loadConfig(accountId);
      if (!config.enabled)
        return {
          skipped: true,
          reason: 'engine_disabled',
          decisions: [{ action: 'HOLD', reason: 'engine_disabled' }] as TceEngineDecision[],
        };
      const account = await this.loadAccount(accountId);
      if (!account)
        return { skipped: true, reason: 'account_not_found', decisions: [] as TceEngineDecision[] };
      const positions = await this.loadPositions(accountId);
      const candidates = await this.loadCandidates(accountId, environment);
      const marketPrices = await this.loadMarketPrices(accountId, [
        ...new Set([...positions.map(p => p.symbol), ...candidates.map(c => c.symbol)]),
      ]);
      const enrichedPositions = positions.map(position => {
        const marketPrice = Number(position.market_price ?? marketPrices[position.symbol] ?? 0);
        const quantity = Number(position.quantity ?? 0);
        const marketValue = marketPrice * quantity;
        const costBasis = Number(position.cost_basis ?? Number(position.avg_cost ?? 0) * quantity);
        const unrealizedPnl = marketValue - costBasis;
        return {
          accountId,
          symbol: position.symbol,
          quantity,
          averagePrice: Number(position.avg_cost ?? 0),
          marketPrice,
          marketValue,
          unrealizedPnl,
          source: 'ssi' as const,
          costBasis,
          unrealizedPnlPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : undefined,
        };
      });
      const totalAssetsValue =
        enrichedPositions.reduce((sum, p) => sum + Math.max(0, p.marketValue || 0), 0) +
        Number(account.capital_available ?? 0);
      const availableBudget = Math.max(0, Number(account.capital_available ?? 0));
      const state: TceEngineAccountState = {
        accountId,
        totalAssetsValue,
        availableBudget,
        positions: enrichedPositions,
        candidates,
      };
      const decisions = tceEngine.evaluate(state, config);
      if (execute) return await this.execute(accountId, environment, state, decisions);
      return { skipped: false, dryRun: true, state, decisions };
    } finally {
      this.running.delete(accountId);
    }
  }

  private async execute(
    accountId: string,
    environment: string,
    state: TceEngineAccountState,
    decisions: TceEngineDecision[]
  ) {
    this.logger.warn(
      `TCE execution request for ${accountId}/${environment} was blocked: raw engine decisions cannot bypass the Risk/Safety Gate`
    );
    return {
      skipped: true,
      reason: 'risk_gate_approval_required',
      executionBoundary: 'tce-risk-safety-gate',
      decisions,
      state,
      executed: [] as Array<Record<string, unknown>>,
      followUpRequired: false,
    };
  }

  private async loadConfig(accountId: string): Promise<TceEngineConfig> {
    const { data, error } = await this.supabase.db
      .from('tce_strategy_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw error;
    return {
      ...DEFAULT_CONFIG,
      enabled: Boolean(data?.engine_enabled ?? data?.is_trading ?? false),
      profitTargetPct: Number(data?.profit_target_pct ?? DEFAULT_CONFIG.profitTargetPct),
      maxTotalAssets: Number(data?.max_positions ?? DEFAULT_CONFIG.maxTotalAssets),
      maxAssetAllocationPct: Number(
        data?.max_asset_allocation_pct ?? DEFAULT_CONFIG.maxAssetAllocationPct
      ),
      buyQuantityStep: Number(data?.buy_quantity_step ?? DEFAULT_CONFIG.buyQuantityStep),
      buyFromRemainingBudget: data?.buy_from_remaining_budget !== false,
    };
  }
  private async loadAccount(accountId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_accounts')
      .select('id,capital_available')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  private async loadPositions(accountId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_positions')
      .select('symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status')
      .eq('account_id', accountId)
      .neq('status', 'CLOSED')
      .order('symbol');
    if (error) throw error;
    return (data ?? []) as Array<Record<string, any>>;
  }
  private async loadCandidates(
    accountId: string,
    _environment: string
  ): Promise<TceEngineCandidate[]> {
    const { data, error } = await this.supabase.db
      .from('tce_buy_candidates')
      .select('symbol,rank,target_price')
      .eq('account_id', accountId)
      .order('rank');
    if (error) throw error;
    if (data?.length)
      return data.map(row => ({
        symbol: String(row.symbol).toUpperCase(),
        rank: Number(row.rank ?? Number.MAX_SAFE_INTEGER),
        price: row.target_price == null ? undefined : Number(row.target_price),
      }));
    const shared = await this.supabase.db
      .from('tce_shared_pools')
      .select('symbol,rank')
      .eq('status', 'ACTIVE')
      .order('rank');
    if (shared.error) throw shared.error;
    return (shared.data ?? []).map(row => ({
      symbol: String(row.symbol).toUpperCase(),
      rank: Number(row.rank ?? Number.MAX_SAFE_INTEGER),
    }));
  }
  private async loadMarketPrices(accountId: string, symbols: string[]) {
    const { data, error } = await this.supabase.db
      .from('tce_market_prices')
      .select('symbol,price,observed_at')
      .eq('user_id', accountId)
      .in('symbol', symbols)
      .order('observed_at', { ascending: false });
    if (error) throw error;
    const prices: Record<string, number> = {};
    for (const row of data ?? [])
      if (prices[row.symbol] == null) prices[row.symbol] = Number(row.price);
    return prices;
  }
}
