import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { DashboardSnapshot, DashboardSourceResult } from '@tce/dashboard-data';
import { SupabaseClientService } from '../db/supabase.client';
import { DashboardSourcesService } from './dashboard-sources.service';

const ENGINE_IDS = ['tce-decision', 'ssi-execution', 'binance-market'] as const;
type EngineId = (typeof ENGINE_IDS)[number];

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseClientService, private readonly sources: DashboardSourcesService) {}

  async getAccount(userId: string) {
    const account = await this.resolveAccount(userId);
    return { userId, accountId: account.id, name: account.name, initial_capital: Number(account.initial_capital ?? 0), capital_deployed: Number(account.capital_deployed ?? 0), capital_available: Number(account.capital_available ?? 0), cashout_target: Number(account.cashout_target ?? 0), cashout_realized: Number(account.cashout_realized ?? 0), recovery_remaining: Number(account.recovery_remaining ?? 0), current_cycle: Number(account.current_cycle ?? 1), status: account.status, max_positions: 0, pool_size: 5 };
  }

  async getPositions(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db.from('tce_positions').select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no').eq('account_id', account.id).neq('status', 'CLOSED').order('symbol');
    if (error) throw this.dbError('getPositions', error);
    return data ?? [];
  }

  async getStrategy(_userId: string) { return null; }
  async getPoolsForUser(userId: string, status?: string) { const account = await this.resolveAccount(userId); return this.getPools(account.id, status); }
  async getNextPositionsForUser(_userId: string) { return []; }
  async getOrdersForUser(_userId: string) { return []; }

  async getSources(_userId: string): Promise<DashboardSourceResult[]> {
    const fetchedAt = new Date().toISOString();
    return [
      { source: 'supabase', available: true, data: { role: 'primary', persisted: true }, fetchedAt, error: null },
      { source: 'ssi', available: false, data: { role: 'account', configured: false, environment: 'production' }, fetchedAt, error: null },
      { source: 'fastapi', available: false, data: { role: 'market-signal', configured: false, config: null }, fetchedAt, error: null },
    ];
  }

  async getEngines(userId: string) {
    const account = await this.resolveAccount(userId);
    const { data, error } = await this.supabase.db.from('tce_engine_states').select('engine_id,status,updated_at').eq('account_id', account.id);
    if (error) throw this.dbError('getEngines', error);
    const states = new Map((data ?? []).map((row: any) => [row.engine_id, row]));
    return ENGINE_IDS.map((engineId) => {
      const state = states.get(engineId);
      return { engineId, status: state?.status ?? 'ACTIVE', updatedAt: state?.updated_at ?? null };
    });
  }

  async setEngineStatus(userId: string, engineId: string, status: string) {
    const account = await this.resolveAccount(userId);
    const normalizedId = String(engineId).trim().toLowerCase();
    const normalizedStatus = String(status).trim().toUpperCase();
    if (!ENGINE_IDS.includes(normalizedId as EngineId)) throw new NotFoundException(`Unknown engine: ${engineId}`);
    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) throw new Error('Engine status must be ACTIVE or INACTIVE');
    const { data, error } = await this.supabase.db.from('tce_engine_states').upsert({ account_id: account.id, engine_id: normalizedId, status: normalizedStatus, updated_at: new Date().toISOString() }, { onConflict: 'account_id,engine_id' }).select('engine_id,status,updated_at').single();
    if (error) throw this.dbError('setEngineStatus', error);
    return { engineId: data.engine_id, status: data.status, updatedAt: data.updated_at };
  }

  async get(userId: string, poolStatus?: string): Promise<DashboardSnapshot> {
    const account = await this.resolveAccount(userId);
    const [positions, pools] = await Promise.all([this.getPositions(userId), this.getPools(account.id, poolStatus)]);
    const deployed = Number(account.capital_deployed ?? 0);
    const unrealized = positions.reduce((sum, p) => sum + Number(p.unrealized_pnl ?? 0), 0);
    return { account: { userId, accountId: account.id, name: account.name, initial_capital: Number(account.initial_capital ?? 0), capital_deployed: Math.round(deployed), capital_available: Number(account.capital_available ?? 0), cashout_target: Number(account.cashout_target ?? 0), cashout_realized: Number(account.cashout_realized ?? 0), recovery_remaining: Number(account.recovery_remaining ?? 0), current_cycle: Number(account.current_cycle ?? 1), unrealized_pnl: Math.round(unrealized), max_positions: 0, pool_size: pools.length }, positions, orders: [], pools, nextPositions: [], sources: await this.getSources(userId) };
  }

  async createPosition(userId: string, input: Record<string, unknown>) {
    const account = await this.resolveAccount(userId); const symbol = String(input.symbol ?? '').trim().toUpperCase(); const quantity = Number(input.quantity ?? 0); const avgCost = Number(input.avg_cost ?? 0);
    if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(avgCost) || avgCost < 0) throw new Error('symbol, quantity and avg_cost are required');
    const costBasis = this.numberOr(input.cost_basis, quantity * avgCost); const marketPrice = this.nullableNumber(input.market_price); const marketValue = this.nullableNumber(input.market_value) ?? (marketPrice == null ? null : quantity * marketPrice); const unrealizedPnl = this.nullableNumber(input.unrealized_pnl) ?? (marketValue == null ? null : marketValue - costBasis); const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));
    const { data, error } = await this.supabase.db.from('tce_positions').upsert({ account_id: account.id, symbol, quantity: Math.trunc(quantity), avg_cost: avgCost, cost_basis: costBasis, market_price: marketPrice, market_value: marketValue, unrealized_pnl: unrealizedPnl, status: String(input.status ?? 'OPEN').trim().toUpperCase(), cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0, updated_at: new Date().toISOString() }, { onConflict: 'account_id,symbol' }).select('id,account_id,symbol,quantity,avg_cost,cost_basis,market_price,market_value,unrealized_pnl,status,cycle_no').single();
    if (error) throw this.dbError('createPosition', error); return data;
  }

  async createOrder(userId: string, input: Record<string, unknown>) {
    const account = await this.resolveAccount(userId); const symbol = String(input.symbol ?? '').trim().toUpperCase(); const side = String(input.side ?? '').trim().toUpperCase(); const price = Number(input.price ?? 0); const quantity = Math.trunc(Number(input.quantity ?? 0));
    if (!symbol || !['BUY', 'SELL'].includes(side) || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity <= 0) throw new Error('symbol, side, price and quantity are required');
    const grossValue = this.numberOr(input.gross_value, price * quantity); const feeTax = this.numberOr(input.fee_tax, 0); const netCashflow = this.numberOr(input.net_cashflow, side === 'BUY' ? -(grossValue + feeTax) : grossValue - feeTax); const cycleNo = Math.trunc(Number(input.cycle_no ?? 0));
    const { data, error } = await this.supabase.db.from('tce_orders').insert({ account_id: account.id, order_date: String(input.order_date ?? new Date().toISOString().slice(0, 10)), symbol, side, price, quantity, gross_value: grossValue, fee_tax: feeTax, net_cashflow: netCashflow, cycle_no: Number.isFinite(cycleNo) ? cycleNo : 0, status: String(input.status ?? 'EXECUTED').trim().toUpperCase(), note: input.note == null ? null : String(input.note) }).select('id,account_id,order_date,symbol,side,price,quantity,gross_value,fee_tax,net_cashflow,cycle_no,status,note,created_at').single();
    if (error) throw this.dbError('createOrder', error); return data;
  }

  private async resolveAccount(userId: string) {
    const direct = await this.supabase.db.from('tce_accounts').select('id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status').eq('user_id', userId).maybeSingle();
    if (direct.error) throw this.dbError('resolveAccount.direct', direct.error); if (direct.data) return direct.data;
    const user = await this.supabase.db.from('users').select('id,email').eq('id', userId).maybeSingle();
    if (user.error) throw this.dbError('resolveAccount.user', user.error); if (!user.data?.email) throw new NotFoundException('Authenticated user is not configured');
    const candidate = await this.supabase.db.from('tce_accounts').select('id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status').eq('name', `USER:${user.data.email}`).maybeSingle();
    if (candidate.error) throw this.dbError('resolveAccount.candidate', candidate.error); if (!candidate.data) throw new NotFoundException('TCE account is not configured for this user');
    const repaired = await this.supabase.db.from('tce_accounts').update({ user_id: userId, updated_at: new Date().toISOString() }).eq('id', candidate.data.id).select('id,user_id,name,initial_capital,cashout_target,cashout_realized,capital_deployed,capital_available,recovery_remaining,current_cycle,status').single();
    if (repaired.error) throw this.dbError('resolveAccount.repair', repaired.error); return repaired.data;
  }

  private async getPools(accountId: string, status?: string) {
    let query = this.supabase.db.from('tce_pool_entries').select('id,account_id,symbol,rank,status,score,cashout_score,liquidity_score,catalyst_score,recovery_score,risk_score,entry_low,entry_high,target_price,invalidation_price,expected_cashout,expected_return_pct,expected_hold_days,rationale,observed_at,expires_at,created_at,updated_at').eq('account_id', accountId);
    const normalizedStatus = String(status ?? '').trim().toUpperCase();
    if (normalizedStatus) query = query.eq('status', normalizedStatus);
    const { data, error } = await query.order('rank', { ascending: true }).limit(50);
    if (error) throw this.dbError('getPools', error); return data ?? [];
  }

  private dbError(operation: string, error: any) { console.error(`[TCE_DASHBOARD_DB] ${operation}`, { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint }); return new ServiceUnavailableException(`Dashboard database error (${operation})`); }
  private numberOr(value: unknown, fallback: number) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  private nullableNumber(value: unknown) { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
}
