import { Injectable, NotFoundException } from '@nestjs/common';
import type { DashboardSnapshot } from '@tce/dashboard-data';
import { SupabaseClientService } from '../db/supabase.client';
import { DashboardSourcesService } from './dashboard-sources.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseClientService, private readonly sources: DashboardSourcesService) {}

  async getAccount(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data: strategy, error } = await this.supabase.db.from('tce_strategy_config').select('account_id,max_positions,pool_size,core_capital,burst_capital,monitor_interval_minutes,market_open,market_close,timezone').eq('account_id', account.id).maybeSingle();
    if (error) throw error;
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
      max_positions: strategy?.max_positions ?? 2,
      pool_size: strategy?.pool_size ?? 5,
    };
  }

  async getPositions(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db.from('tce_positions').select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no').eq('account_id', account.id).neq('status', 'CLOSED').order('symbol');
    if (error) throw error;
    return data ?? [];
  }

  async getStrategy(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db.from('tce_strategy_config').select('account_id,max_positions,pool_size,core_capital,burst_capital,monitor_interval_minutes,market_open,market_close,timezone,updated_at').eq('account_id', account.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async getPoolsForUser(userId: string) {
    const account = await this.resolveAccount(userId);
    return this.getPools(account.id);
  }

  async getNextPositionsForUser(userId: string) {
    const account = await this.resolveAccount(userId);
    return this.getNextPositions(account.id);
  }

  async getOrdersForUser(userId: string) {
    const account = await this.resolveAccount(userId);
    return this.getOrders(account.id);
  }

  async getSources(userId: string) {
    return this.sources.status(userId);
  }

  async get(userId: string): Promise<DashboardSnapshot> {
    const account = await this.resolveAccount(userId);
    const [positions, strategy, pools, nextPositions, orders, sources] = await Promise.all([
      this.getPositions(userId),
      this.getStrategy(userId),
      this.getPools(account.id),
      this.getNextPositions(account.id),
      this.getOrders(account.id),
      this.sources.status(userId),
    ]);
    const rows = positions;
    const deployed = Number(account.capital_deployed ?? rows.reduce((sum, p) => sum + Number(p.market_value ?? p.cost_basis ?? 0), 0));
    const unrealized = rows.reduce((sum, p) => sum + Number(p.unrealized_pnl ?? 0), 0);
    return {
      account: {
        userId,
        accountId: account.id,
        name: account.name,
        initial_capital: Number(account.initial_capital ?? 0),
        capital_deployed: Math.round(deployed),
        capital_available: Number(account.capital_available ?? Math.max(0, Number(account.initial_capital ?? 0) - deployed)),
        cashout_target: Number(account.cashout_target ?? 0),
        cashout_realized: Number(account.cashout_realized ?? 0),
        recovery_remaining: Number(account.recovery_remaining ?? 0),
        current_cycle: Number(account.current_cycle ?? Math.max(1, ...rows.map((p) => Number(p.cycle_no ?? 1)))),
        unrealized_pnl: Math.round(unrealized),
        max_positions: strategy?.max_positions ?? 2,
        pool_size: strategy?.pool_size ?? 5,
      },
      positions: rows,
      orders,
      pools,
      nextPositions,
      sources,
    };
  }

  async createPosition(userId: string, input: Record<string, unknown>) {
    const account = await this.resolveAccount(userId);
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    const quantity = Number(input.quantity ?? 0);
    const avgCost = Number(input.avg_cost ?? 0);
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(avgCost) || avgCost < 0) throw new Error('symbol, quantity and avg_cost are required');
    const costBasis = this.numberOr(input.cost_basis, quantity * avgCost);
    const marketPrice = this.nullableNumber(input.market_price);
    const marketValue = this.nullableNumber(input.market_value) ?? (marketPrice == null ? null : quantity * marketPrice);
    const unrealizedPnl = this.nullableNumber(input.unrealized_pnl) ?? (marketValue == null ? null : marketValue - costBasis);
    const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));
    const { data, error } = await this.supabase.db.from('tce_positions').upsert({ account_id: account.id, symbol, quantity: Math.trunc(quantity), avg_cost: avgCost, cost_basis: costBasis, market_price: marketPrice, market_value: marketValue, unrealized_pnl: unrealizedPnl, status: String(input.status ?? 'OPEN').trim().toUpperCase(), cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0, updated_at: new Date().toISOString() }, { onConflict: 'account_id,symbol' }).select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no').single();
    if (error) throw error;
    return data;
  }

  async createOrder(userId: string, input: Record<string, unknown>) {
    const account = await this.resolveAccount(userId);
    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    const side = String(input.side ?? '').trim().toUpperCase();
    const price = Number(input.price ?? 0);
    const quantity = Math.trunc(Number(input.quantity ?? 0));
    if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity <= 0) throw new Error('symbol, side, price and quantity are required');
    const grossValue = this.numberOr(input.gross_value, price * quantity);
    const feeTax = this.numberOr(input.fee_tax, 0);
    const netCashflow = this.numberOr(input.net_cashflow, side === 'BUY' ? -(grossValue + feeTax) : grossValue - feeTax);
    const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));
    const { data, error } = await this.supabase.db.from('tce_orders').insert({ account_id: account.id, order_date: String(input.order_date ?? new Date().toISOString().slice(0, 10)), symbol, side, price, quantity, gross_value: grossValue, fee_tax: feeTax, net_cashflow: netCashflow, cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0, status: String(input.status ?? 'EXECUTED').trim().toUpperCase(), note: input.note == null ? null : String(input.note) }).select('id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at').single();
    if (error) throw error;
    return data;
  }

  private async resolveAccount(userId: string) {
    const { data, error } = await this.supabase.db.from('tce_accounts').select('id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('TCE account is not configured for this user');
    return data;
  }

  private async getPools(accountId: string) {
    const { data, error } = await this.supabase.db.from('tce_pool_entries').select('id,account_id,symbol,rank,status,score,cashout_score,liquidity_score,catalyst_score,recovery_score,risk_score,entry_low,entry_high,target_price,invalidation_price,expected_cashout,expected_return_pct,expected_hold_days,rationale,observed_at,expires_at,created_at,updated_at').eq('account_id', accountId).order('rank', { ascending: true }).limit(50);
    if (error) throw error;
    return data ?? [];
  }

  private async getNextPositions(accountId: string) {
    const { data, error } = await this.supabase.db.from('tce_buy_candidates').select('id,account_id,symbol,rank,target_position,target_quantity,target_price,status,reason,score,pool_entry_id,promoted_at,created_at,updated_at').eq('account_id', accountId).in('status', ['queued', 'ready']).order('rank', { ascending: true }).limit(5);
    if (error) throw error;
    return data ?? [];
  }

  private async getOrders(accountId: string) {
    const { data, error } = await this.supabase.db.from('tce_orders').select('id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data ?? [];
  }

  private numberOr(value: unknown, fallback: number) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  private nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
}
