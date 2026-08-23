import { AccountPosition, PositionRepository } from '@tce/contracts';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabasePositionAdapter implements PositionRepository {
  constructor(private readonly db: SupabaseClient) {}
  async listOpen(accountId: string) { const { data, error } = await this.db.from('tce_positions').select('*').eq('account_id', accountId).eq('status','OPEN'); if (error) throw error; return (data ?? []).map((p) => ({ symbol: String(p.symbol), quantity: Number(p.quantity ?? 0), averagePrice: Number(p.avg_cost ?? 0), marketPrice: p.market_price == null ? undefined : Number(p.market_price), marketValue: p.market_value == null ? undefined : Number(p.market_value), unrealizedPnl: p.unrealized_pnl == null ? undefined : Number(p.unrealized_pnl), source: 'supabase' })); }
  async upsert(position: AccountPosition) { const row = { symbol: position.symbol, quantity: position.quantity, avg_cost: position.averagePrice, market_price: position.marketPrice ?? null, market_value: position.marketValue ?? null, unrealized_pnl: position.unrealizedPnl ?? null, status: 'OPEN', updated_at: new Date().toISOString() }; const { data, error } = await this.db.from('tce_positions').upsert(row, { onConflict: 'account_id,symbol' }).select('*').single(); if (error) throw error; return { ...position, source: 'supabase' as const, quantity: Number(data.quantity ?? position.quantity), averagePrice: Number(data.avg_cost ?? position.averagePrice) }; }
}
