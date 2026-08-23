import { AccountOrder, OrderRepository } from '@tce/contracts';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseOrderAdapter implements OrderRepository {
  constructor(private readonly db: SupabaseClient) {}
  async list(accountId: string) { const { data, error } = await this.db.from('tce_orders').select('*').eq('account_id', accountId).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []).map((o) => ({ accountId, externalId: String(o.note ?? o.id), symbol: String(o.symbol), side: String(o.side).toUpperCase() === 'SELL' ? 'SELL' as const : 'BUY' as const, quantity: Number(o.quantity ?? 0), price: o.price == null ? undefined : Number(o.price), status: String(o.status ?? 'UNKNOWN'), createdAt: o.created_at ? String(o.created_at) : undefined, source: 'supabase' as const })); }
  async create(order: AccountOrder) { if (!order.accountId) throw new Error('accountId is required'); const gross = Number(order.quantity) * Number(order.price ?? 0); const row = { account_id: order.accountId, order_date: (order.createdAt ?? new Date().toISOString()).slice(0,10), symbol: order.symbol, side: order.side, price: order.price ?? 0, quantity: order.quantity, gross_value: gross, fee_tax: 0, net_cashflow: order.side === 'BUY' ? -gross : gross, cycle_no: 0, status: order.status, note: `SSI order ${order.externalId}` }; const { error } = await this.db.from('tce_orders').insert(row); if (error) throw error; return { ...order, source: 'supabase' as const }; }
}
