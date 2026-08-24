import { DashboardSourcePort, ContractResult } from '@tce/contracts';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseDashboardSource implements DashboardSourcePort {
  readonly source = 'supabase';
  constructor(private readonly db: SupabaseClient) {}
  async snapshot(userId: string): Promise<ContractResult<unknown>> {
    try {
      const [positions, orders, pools, nextPositions] = await Promise.all([
        this.db.from('tce_positions').select('*').eq('account_id', userId),
        this.db.from('tce_orders').select('*').eq('account_id', userId).order('created_at', { ascending: false }),
        this.db.from('tce_shared_pools').select('*'),
        this.db.from('tce_shared_next_positions').select('*')
      ]);
      const error = positions.error ?? orders.error ?? pools.error ?? nextPositions.error;
      if (error) return { ok: false, error: { code: 'PROVIDER_ERROR', message: error.message, retryable: true, provider: this.source } };
      return { ok: true, data: { positions: positions.data ?? [], orders: orders.data ?? [], pools: pools.data ?? [], nextPositions: nextPositions.data ?? [] } };
    } catch (error) { return { ok: false, error: { code: 'PROVIDER_ERROR', message: error instanceof Error ? error.message : String(error), retryable: true, provider: this.source } }; }
  }
}
