import type { SupabaseClient } from '@supabase/supabase-js';
import type { TceReconciliationLifecycleEvent, TceReconciliationLifecycleSink } from '@tce/tce';

export class SupabaseReconciliationLifecycleSink implements TceReconciliationLifecycleSink {
  constructor(private readonly db: SupabaseClient) {}

  async has(eventId: string): Promise<boolean> {
    if (!eventId) throw new Error('eventId is required');
    const { data, error } = await this.db
      .from('tce_reconciliation_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async publish(event: TceReconciliationLifecycleEvent): Promise<void> {
    if (!event.eventId) throw new Error('eventId is required');
    if (!event.runId || !event.accountId || !event.environment) {
      throw new Error('runId, accountId and environment are required');
    }

    const { error } = await this.db.from('tce_reconciliation_events').insert({
      event_id: event.eventId,
      run_id: event.runId,
      account_id: event.accountId,
      environment: event.environment,
      correlation_id: event.correlationId,
      event_type: event.type,
      observed_at: event.observedAt,
      disposition: event.disposition,
      local_order_id: event.localOrderId ?? null,
      provider_order_id: event.providerOrderId ?? null,
      provider_state: event.providerState ?? null,
      provider_status: event.providerStatus ?? null,
      local_status: event.localStatus ?? null,
      local_filled_quantity: event.localFilledQuantity ?? null,
      provider_filled_quantity: event.providerFilledQuantity ?? null,
      reason: event.reason,
    });

    if (error && !isDuplicateKey(error)) throw error;
  }
}

function isDuplicateKey(error: { code?: string }): boolean {
  return error.code === '23505';
}
