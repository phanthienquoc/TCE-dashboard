import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { DashboardSnapshot, DashboardSourceResult } from '@tce/dashboard-data';
import { SupabaseClientService } from '../db/supabase.client';
import { DashboardSourcesService } from './dashboard-sources.service';

const ENGINE_IDS = ['tce-decision', 'ssi-execution', 'binance-market'] as const;
type EngineId = (typeof ENGINE_IDS)[number];
const DEFAULT_ENGINE_CONFIG = {
  enabled: false,
  profitTargetPct: 10,
  maxTotalAssets: 5,
  maxAssetAllocationPct: 40,
  buyQuantityStep: 100,
  buyFromRemainingBudget: true,
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly sources: DashboardSourcesService
  ) {}
  async getAccount(userId: string) {
    const account = await this.resolveAccount(userId);
    return {
      userId,
      accountId: account.id,
      name: account.name,
      initial_capital: Number(account.initial_capital ?? 0),
      capital_deployed: Number(account.capital_deployed ?? 0),
      capital_available: Number(account.capital_available ?? 0),
      cashout_target: Number(account.cashout_target ?? 0),
      cashout_realized: Number(account.cashout_realized ?? 0),
      recovery_remaining: Number(account.recovery_remaining ?? 0),
      current_cycle: Number(account.current_cycle ?? 1),
      status: account.status,
      max_positions: 0,
      pool_size: 5,
    };
  }
  async getPositions(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db
      .from('tce_positions')
      .select(
        'id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no'
      )
      .eq('account_id', account.id)
      .neq('status', 'CLOSED')
      .order('symbol');
    if (error) throw this.dbError('getPositions', error);
    return (data ?? []).map(p => ({
      ...p,
      avgBuyCost: Number(p.avg_cost ?? 0),
      marketPrice: p.market_price == null ? null : Number(p.market_price),
      marketValue: p.market_value == null ? null : Number(p.market_value),
      unrealizedPnl: p.unrealized_pnl == null ? null : Number(p.unrealized_pnl),
    }));
  }
  async getStrategy(_userId: string) {
    return null;
  }
  async getPoolsForUser(userId: string, status?: string) {
    const account = await this.resolveAccount(userId);
    return this.getPools(account.id, userId, status);
  }
  async getNextPositionsForUser(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db
      .from('tce_buy_candidates')
      .select(
        'id,account_id,symbol,rank,target_position,target_quantity,target_price,status,reason,score,pool_entry_id,promoted_at,created_at,updated_at'
      )
      .eq('account_id', account.id)
      .in('status', ['queued', 'ready'])
      .order('rank', { ascending: true })
      .limit(20);
    if (error) throw this.dbError('getNextPositionsForUser', error);
    return (data ?? []).map(candidate => ({
      ...candidate,
      targetPosition: candidate.target_position == null ? null : Number(candidate.target_position),
      targetQuantity: candidate.target_quantity == null ? null : Number(candidate.target_quantity),
      targetPrice: candidate.target_price == null ? null : Number(candidate.target_price),
      score: candidate.score == null ? null : Number(candidate.score),
    }));
  }
  async getOrdersForUser(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db
      .from('tce_orders')
      .select(
        'id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at'
      )
      .eq('account_id', account.id)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw this.dbError('getOrdersForUser', error);
    return (data ?? []).map(o => ({
      ...o,
      grossValue: Number(o.gross_value ?? 0),
      feeTax: Number(o.fee_tax ?? 0),
      netCashflow: Number(o.net_cashflow ?? 0),
    }));
  }
  async getSources(userId: string): Promise<DashboardSourceResult[]> {
    const fetchedAt = new Date().toISOString();
    const { data: ssiCredential, error } = await this.supabase.db
      .from('platform_credentials')
      .select('id,ssi_account_no')
      .eq('user_id', userId)
      .eq('provider', 'ssi')
      .eq('environment', 'production')
      .eq('is_active', true)
      .maybeSingle();
    const ssiConfigured = !error && Boolean(ssiCredential?.id);
    return [
      {
        source: 'supabase',
        available: true,
        data: { role: 'primary', persisted: true },
        fetchedAt,
        error: null,
      },
      {
        source: 'ssi',
        available: ssiConfigured,
        data: {
          role: 'account',
          configured: ssiConfigured,
          environment: 'production',
          accountNo: ssiCredential?.ssi_account_no ?? null,
        },
        fetchedAt,
        error: error ? 'Unable to inspect SSI configuration' : null,
      },
      {
        source: 'fastapi',
        available: false,
        data: { role: 'market-signal', configured: false, config: null },
        fetchedAt,
        error: null,
      },
    ];
  }
  async getEngines(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db
      .from('tce_engine_states')
      .select('engine_id,status,updated_at')
      .eq('account_id', account.id);
    if (error) throw this.dbError('getEngines', error);
    const states = new Map((data ?? []).map((row: any) => [row.engine_id, row]));
    return ENGINE_IDS.map(engineId => {
      const state = states.get(engineId);
      return { engineId, status: state?.status ?? 'ACTIVE', updatedAt: state?.updated_at ?? null };
    });
  }
  async setEngineStatus(userId: string, engineId: string, status: string) {
    const account = await this.resolveAccount(userId);
    const normalizedId = String(engineId).trim().toLowerCase();
    const normalizedStatus = String(status).trim().toUpperCase();
    if (!ENGINE_IDS.includes(normalizedId as EngineId))
      throw new NotFoundException(`Unknown engine: ${engineId}`);
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus))
      throw new Error('Engine status must be ACTIVE or INACTIVE');
    const { data, error } = await this.supabase.db
      .from('tce_engine_states')
      .upsert(
        {
          account_id: account.id,
          engine_id: normalizedId,
          status: normalizedStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,engine_id' }
      )
      .select('engine_id,status,updated_at')
      .single();
    if (error) throw this.dbError('setEngineStatus', error);
    return { engineId: data.engine_id, status: data.status, updatedAt: data.updated_at };
  }
  async getEngineConfig(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db
      .from('tce_strategy_config')
      .select(
        'engine_enabled,profit_target_pct,max_positions,max_asset_allocation_pct,buy_quantity_step,buy_from_remaining_budget,updated_at'
      )
      .eq('account_id', account.id)
      .maybeSingle();
    if (error) throw this.dbError('getEngineConfig', error);
    return {
      ...DEFAULT_ENGINE_CONFIG,
      ...(data
        ? {
            enabled: Boolean(data.engine_enabled),
            profitTargetPct: Number(
              data.profit_target_pct ?? DEFAULT_ENGINE_CONFIG.profitTargetPct
            ),
            maxTotalAssets: Number(data.max_positions ?? DEFAULT_ENGINE_CONFIG.maxTotalAssets),
            maxAssetAllocationPct: Number(
              data.max_asset_allocation_pct ?? DEFAULT_ENGINE_CONFIG.maxAssetAllocationPct
            ),
            buyQuantityStep: Number(
              data.buy_quantity_step ?? DEFAULT_ENGINE_CONFIG.buyQuantityStep
            ),
            buyFromRemainingBudget: data.buy_from_remaining_budget !== false,
            updatedAt: data.updated_at ?? null,
          }
        : {}),
    };
  }
  async setEngineConfig(userId: string, config: Record<string, unknown>) {
    const account = await this.resolveAccount(userId);
    const payload = {
      account_id: account.id,
      engine_enabled:
        config.enabled == null ? DEFAULT_ENGINE_CONFIG.enabled : Boolean(config.enabled),
      profit_target_pct: this.numberOr(
        config.profitTargetPct,
        DEFAULT_ENGINE_CONFIG.profitTargetPct
      ),
      max_positions: Math.max(
        1,
        Math.trunc(this.numberOr(config.maxTotalAssets, DEFAULT_ENGINE_CONFIG.maxTotalAssets))
      ),
      max_asset_allocation_pct: this.numberOr(
        config.maxAssetAllocationPct,
        DEFAULT_ENGINE_CONFIG.maxAssetAllocationPct
      ),
      buy_quantity_step: Math.max(
        1,
        Math.trunc(this.numberOr(config.buyQuantityStep, DEFAULT_ENGINE_CONFIG.buyQuantityStep))
      ),
      buy_from_remaining_budget: config.buyFromRemainingBudget !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.supabase.db
      .from('tce_strategy_config')
      .upsert(payload, { onConflict: 'account_id' })
      .select(
        'engine_enabled,profit_target_pct,max_positions,max_asset_allocation_pct,buy_quantity_step,buy_from_remaining_budget,updated_at'
      )
      .single();
    if (error) throw this.dbError('setEngineConfig', error);
    return {
      enabled: Boolean(data.engine_enabled),
      profitTargetPct: Number(data.profit_target_pct),
      maxTotalAssets: Number(data.max_positions),
      maxAssetAllocationPct: Number(data.max_asset_allocation_pct),
      buyQuantityStep: Number(data.buy_quantity_step),
      buyFromRemainingBudget: data.buy_from_remaining_budget !== false,
      updatedAt: data.updated_at,
    };
  }
  async get(userId: string, poolStatus?: string): Promise<DashboardSnapshot> {
    const account = await this.resolveAccount(userId);
    const [positions, pools, nextPositions, orders, sources] = await Promise.all([
      this.getPositions(userId),
      this.getPools(account.id, userId, poolStatus),
      this.getNextPositionsForUser(userId),
      this.getOrdersForUser(userId),
      this.getSources(userId),
    ]);
    const deployed = Number(account.capital_deployed ?? 0);
    const cash = Number(account.capital_available ?? 0);
    const marketValue = positions.reduce((sum, p) => sum + Number(p.market_value ?? 0), 0);
    const unrealized = positions.reduce((sum, p) => sum + Number(p.unrealized_pnl ?? 0), 0);
    const brokerAccounts = sources.find(source => source.source === 'ssi')?.data as
      Record<string, unknown> | undefined;
    return {
      account: {
        userId,
        accountId: account.id,
        name: account.name,
        initial_capital: Number(account.initial_capital ?? 0),
        capital_deployed: Math.round(deployed),
        capital_available: cash,
        cashout_target: Number(account.cashout_target ?? 0),
        cashout_realized: Number(account.cashout_realized ?? 0),
        recovery_remaining: Number(account.recovery_remaining ?? 0),
        current_cycle: Number(account.current_cycle ?? 1),
        unrealized_pnl: Math.round(unrealized),
        market_value: Math.round(marketValue),
        totalValue: Math.round(cash + marketValue),
        max_positions: 0,
        pool_size: pools.length,
      },
      positions,
      orders,
      pools,
      nextPositions,
      balance: { cash, equity: cash + marketValue, withdrawable: cash, source: 'supabase' },
      brokerAccounts: brokerAccounts?.configured
        ? [
            {
              provider: 'ssi',
              accountNo: brokerAccounts.accountNo ?? undefined,
              environment: 'production',
              status: 'Connected',
            },
          ]
        : [],
      sources,
    };
  }
  private async resolveAccount(userId: string) {
    const direct = await this.supabase.db
      .from('tce_accounts')
      .select(
        'id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status'
      )
      .eq('user_id', userId)
      .maybeSingle();
    if (direct.error) throw this.dbError('resolveAccount.direct', direct.error);
    if (direct.data) return direct.data;
    const user = await this.supabase.db
      .from('users')
      .select('id,email')
      .eq('id', userId)
      .maybeSingle();
    if (user.error) throw this.dbError('resolveAccount.user', user.error);
    if (!user.data?.email) throw new NotFoundException('Authenticated user is not configured');
    const candidate = await this.supabase.db
      .from('tce_accounts')
      .select(
        'id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status'
      )
      .eq('name', `USER:${user.data.email}`)
      .maybeSingle();
    if (candidate.error) throw this.dbError('resolveAccount.candidate', candidate.error);
    if (!candidate.data) throw new NotFoundException('TCE account is not configured for this user');
    const repaired = await this.supabase.db
      .from('tce_accounts')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', candidate.data.id)
      .select(
        'id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,cashout_target,cashout_realized,recovery_remaining,current_cycle,status'
      )
      .single();
    if (repaired.error) throw this.dbError('resolveAccount.repair', repaired.error);
    return repaired.data;
  }
  private async getPools(accountId: string, userId: string, status?: string) {
    let query = this.supabase.db
      .from('tce_pool_entries')
      .select(
        'id,account_id,symbol,rank,status,score,cashout_score,liquidity_score,catalyst_score,recovery_score,risk_score,entry_low,entry_high,target_price,invalidation_price,expected_cashout,expected_return_pct,expected_hold_days,rationale,observed_at,expires_at,created_at,updated_at'
      )
      .eq('account_id', accountId);
    const normalizedStatus = String(status ?? '')
      .trim()
      .toUpperCase();
    if (normalizedStatus) query = query.eq('status', normalizedStatus);
    const { data, error } = await query.order('rank', { ascending: true }).limit(50);
    if (error) throw this.dbError('getPools', error);
    return data ?? [];
  }
  private dbError(operation: string, error: any) {
    console.error(`[TCE_DASHBOARD_DB] ${operation}`, {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return new ServiceUnavailableException(`Dashboard database error (${operation})`);
  }
  private numberOr(value: unknown, fallback: number) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
}
