import { Injectable } from '@nestjs/common';
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
    const [positions, strategy] = await Promise.all([
      this.supabase.db.from('tce_positions')
        .select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no')
        .eq('account_id', userId)
        .neq('status', 'CLOSED')
        .order('symbol'),
      this.supabase.db.from('tce_strategy_config')
        .select('account_id,max_positions,pool_size,monitor_interval_minutes,market_open,market_close,timezone')
        .eq('account_id', userId)
        .maybeSingle(),
    ]);

    if (positions.error) throw positions.error;
    if (strategy.error) throw strategy.error;

    const rows = (positions.data ?? []) as Position[];
    const deployed = rows.reduce((sum, p) => sum + Number(p.market_value ?? p.cost_basis ?? 0), 0);
    const unrealized = rows.reduce((sum, p) => sum + Number(p.unrealized_pnl ?? 0), 0);

    const [pools, nextPositions, orders] = await Promise.all([
      this.safeShared('tce_shared_pools', 'id,symbol,rank,status,metadata,updated_at'),
      this.safeShared('tce_shared_next_positions', 'id,rank,symbol,target_quantity,target_price,reason,status,updated_at'),
      this.safeAccount('tce_orders', userId, 'id,symbol,side,quantity,price,gross_value,status,created_at'),
    ]);

    return {
      account: {
        userId,
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
      // Compatibility for the existing UI: next position is shared, not per-account.
      candidates: nextPositions,
    };
  }

  private async safeShared(table: string, columns: string) {
    const { data, error } = await this.supabase.db.from(table).select(columns).order('rank', { ascending: true });
    if (error) return [];
    return data ?? [];
  }

  private async safeAccount(table: string, userId: string, columns: string) {
    const { data, error } = await this.supabase.db.from(table).select(columns).eq('account_id', userId).order('created_at', { ascending: false }).limit(20);
    if (error) return [];
    return data ?? [];
  }
}
