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
      this.safeAccount('tce_orders', userId, 'id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at'),
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
      candidates: nextPositions,
    };
  }

  async createPosition(userId: string, input: Record<string, unknown>) {
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    const quantity = Number(input.quantity ?? 0);
    const avgCost = Number(input.avg_cost ?? 0);
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(avgCost) || avgCost < 0) {
      throw new Error('symbol, quantity and avg_cost are required');
    }

    const costBasis = this.numberOr(input.cost_basis, quantity * avgCost);
    const marketPrice = this.nullableNumber(input.market_price);
    const marketValue = this.nullableNumber(input.market_value) ?? (marketPrice == null ? null : quantity * marketPrice);
    const unrealizedPnl = this.nullableNumber(input.unrealized_pnl) ?? (marketValue == null ? null : marketValue - costBasis);
    const status = String(input.status ?? 'OPEN').trim().toUpperCase();
    const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));

    const { data, error } = await this.supabase.db.from('tce_positions').upsert({
      account_id: userId,
      symbol,
      quantity: Math.trunc(quantity),
      avg_cost: avgCost,
      cost_basis: costBasis,
      market_price: marketPrice,
      market_value: marketValue,
      unrealized_pnl: unrealizedPnl,
      status,
      cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,symbol' }).select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no').single();

    if (error) throw error;
    return data;
  }

  async createOrder(userId: string, input: Record<string, unknown>) {
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    const side = String(input.side ?? '').trim().toUpperCase();
    const price = Number(input.price ?? 0);
    const quantity = Math.trunc(Number(input.quantity ?? 0));
    if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('symbol, side, price and quantity are required');
    }

    const grossValue = this.numberOr(input.gross_value, price * quantity);
    const feeTax = this.numberOr(input.fee_tax, 0);
    const netCashflow = this.numberOr(input.net_cashflow, side === 'BUY' ? -(grossValue + feeTax) : grossValue - feeTax);
    const orderDate = String(input.order_date ?? new Date().toISOString().slice(0, 10));
    const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));
    const status = String(input.status ?? 'EXECUTED').trim().toUpperCase();
    const note = input.note == null ? null : String(input.note);

    const { data, error } = await this.supabase.db.from('tce_orders').insert({
      account_id: userId,
      order_date: orderDate,
      symbol,
      side,
      price,
      quantity,
      gross_value: grossValue,
      fee_tax: feeTax,
      net_cashflow: netCashflow,
      cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0,
      status,
      note,
    }).select('id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at').single();

    if (error) throw error;
    return data;
  }

  private numberOr(value: unknown, fallback: number) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private nullableNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
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
