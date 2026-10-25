import { DashboardSourcePort, ContractResult } from '@tce/contracts';
import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseDashboardSource implements DashboardSourcePort {
  readonly source = 'supabase';
  constructor(private readonly db: SupabaseClient) {}

  async snapshot(userId: string): Promise<ContractResult<unknown>> {
    try {
      const { data: account, error: accountError } = await this.db
        .from('tce_accounts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (accountError) return this.providerError(accountError.message);
      if (!account) return this.providerError('TCE account is not configured for this user', false);

      const [positions, orders, pools, nextPositions] = await Promise.all([
        this.db.from('tce_positions').select('*').eq('account_id', account.id),
        this.db
          .from('tce_orders')
          .select('*')
          .eq('account_id', account.id)
          .order('created_at', { ascending: false }),
        this.db
          .from('tce_pool_entries')
          .select('*')
          .eq('account_id', account.id)
          .order('rank', { ascending: true }),
        this.db
          .from('tce_buy_candidates')
          .select('*')
          .eq('account_id', account.id)
          .in('status', ['queued', 'ready'])
          .order('rank', { ascending: true }),
      ]);
      const error = positions.error ?? orders.error ?? pools.error ?? nextPositions.error;
      if (error) return this.providerError(error.message);
      return {
        ok: true,
        data: {
          positions: positions.data ?? [],
          orders: orders.data ?? [],
          pools: pools.data ?? [],
          nextPositions: nextPositions.data ?? [],
        },
      };
    } catch (error) {
      return this.providerError(error instanceof Error ? error.message : String(error));
    }
  }

  private providerError(message: string, retryable = true): ContractResult<unknown> {
    return {
      ok: false,
      error: { code: 'PROVIDER_ERROR', message, retryable, provider: this.source },
    };
  }
}
