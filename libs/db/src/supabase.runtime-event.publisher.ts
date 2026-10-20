import {
  isTceRuntimeEvent,
  type TceEventPublisherPort,
  type TceRuntimeEvent,
  type TceRuntimeEventType,
} from '@tce/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

type RuntimeEventRow = {
  event_id: string;
  event_type: TceRuntimeEventType;
  schema_version: number;
  occurred_at: string;
  producer: string;
  correlation_id: string;
  account_id: string | null;
  aggregate_id: string | null;
  sequence: number | null;
  data: unknown;
};

/**
 * Durable publisher/outbox adapter. Duplicate event IDs are idempotent;
 * transport-specific framing is deliberately outside this persistence port.
 */
export class SupabaseRuntimeEventPublisher implements TceEventPublisherPort {
  constructor(private readonly db: SupabaseClient) {}

  async publish<TType extends TceRuntimeEventType>(event: TceRuntimeEvent<TType>): Promise<void> {
    if (!isTceRuntimeEvent(event)) {
      throw new Error('Invalid TCE runtime event envelope');
    }

    const row: RuntimeEventRow = {
      event_id: event.eventId,
      event_type: event.eventType,
      schema_version: event.schemaVersion,
      occurred_at: event.occurredAt,
      producer: event.producer,
      correlation_id: event.correlationId,
      account_id: event.accountId ?? null,
      aggregate_id: event.aggregateId ?? null,
      sequence: event.sequence ?? null,
      data: event.data,
    };
    const { error } = await this.db.from('tce_runtime_events').insert(row);
    if (error?.code === '23505') return;
    if (error) throw error;
  }
}
