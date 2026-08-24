import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

type Position = {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  cost_basis: number;
  market_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  status: string;
  cycle_no: number | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async get(userId: string) {
    const accountId = await this.resolveAccountId(userId);

    const [positions, strategy] = await Promise.all([
      this.supabase.db.from('tce_positions')
        .select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no')
        .eq('account_id', accountId)
        .neq('status', 'CLOSED')
        .order('symbol'),
      this.supabase.db.from('tce_strategy_config')
        .select('account_id,max_positions,pool_size,monitor_interval_minutes,market_open,market_close,timezone')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);

    if (positions.error) throw positions.error;
    if (strategy.error) throw strategy.error;

    const rows = (positions.data ?? []) as Position[];
    const deployed = rows.reduce((sum, p) => sum + Number(p.market_value ?? p.cost_basis ?? 0), 0);
    const unrealized = rows.reduce((sum, p) => sum + Number(p.unrealized_pnl ?? 0), 0);

    const [pools, nextPositions, orders] = await Promise.all([
      this.getPool(accountId),
      this.getNextPositions(accountId),
      this.getOrders(accountId),
    ]);

    return {
      account: {
        userId,
        accountId,
        initial_capital: 0,
        capital_deployed: Math.round(deployed),
        capital_available: 0,
        cashout_realized: 0,
        recovery_remaining: 0,
        current_cycle: Math.max(1, ...rows.map((p) => Number(p.cycle_no ?? 1))),
        unrealized_pnl: Math.round(unrealized),
        max_positions: strategy.data?.max_positions ?? 2,
      },
      positions: rows,
      orders,
      pools,
      nextPositions,
      // Compatibility for the existing UI.
      candidates: nextPositions,
    };
  }

  private async resolveAccountId(userId: string): Promise<string> {
    const { data: mapped, error: mappedError } = await this.supabase.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (mappedError) throw mappedError;
    if (mapped?.id) return mapped.id;

    // Compatibility for databases that have not applied the account mapping
    // migration yet. The migration makes user_id authoritative afterward.
    const { data: user, error: userError } = await this.supabase.db
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: legacyAccount, error: accountError } = await this.supabase.db
      .from('tce_accounts')
      .select('id')
      .ilike('name', `USER:${user.email}`)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!legacyAccount?.id) throw new NotFoundException('TCE account is not configured for this user');
    return legacyAccount.id;
  }

  private async getPool(accountId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_pool_entries')
      .select('id,symbol,rank,status,score,cashout_score,liquidity_score,catalyst_score,recovery_score,risk_score,entry_low,entry_high,target_price,invalidation_price,expected_cashout,expected_return_pct,expected_hold_days,rationale,observed_at,expires_at,created_at,updated_at')
      .eq('account_id', accountId)
      .order('rank', { ascending: true })
      .limit(50);

    if (error) throw error;
    return data ?? [];
  }

  private async getNextPositions(accountId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_buy_candidates')
      .select('id,symbol,rank,target_position,target_quantity,target_price,status,reason,score,pool_entry_id,promoted_at,created_at,updated_at')
      .eq('account_id', accountId)
      .in('status', ['queued', 'ready'])
      .order('rank', { ascending: true })
      .limit(5);

    if (error) throw error;
    return data ?? [];
  }

  private async getOrders(accountId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_orders')
      .select('id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data ?? [];
  }
}
