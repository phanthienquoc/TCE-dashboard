import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isTceRuntimeEvent, isTceRuntimeEventType, type TceEventEnvelope } from '@tce/contracts';
import { SupabaseClientService } from '../db/supabase.client';

export type RuntimeEventQuery = Readonly<{
  after?: string;
  afterEventId?: string;
  limit?: number;
  eventType?: string;
}>;

@Injectable()
export class RuntimeEventsQueryService {
  constructor(private readonly supabase: SupabaseClientService) {}

  /**
   * Resolve an SSE Last-Event-ID to the durable composite cursor without
   * allowing an event from another account to establish the resume position.
   * event_id is the table primary key; the account predicate remains mandatory.
   */
  async findCursorForAccountEvent(accountId: string, eventId: string) {
    if (!accountId.trim()) throw new Error('Authenticated account is required');
    if (!/^[A-Za-z0-9._:-]{1,256}$/.test(eventId)) {
      throw new Error('The event ID cursor is invalid');
    }

    const { data, error } = await this.supabase.db
      .from('tce_runtime_events')
      .select('event_id,occurred_at')
      .eq('account_id', accountId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException({
        ok: false,
        error: {
          code: 'RUNTIME_EVENT_STORE_UNAVAILABLE',
          message: 'Runtime event store is unavailable',
          retryable: true,
        },
      });
    }

    if (
      !data ||
      typeof data.event_id !== 'string' ||
      typeof data.occurred_at !== 'string' ||
      !Number.isFinite(Date.parse(data.occurred_at))
    ) {
      return null;
    }

    return { occurredAt: data.occurred_at, eventId: data.event_id };
  }

  async listForAccount(accountId: string, query: RuntimeEventQuery = {}) {
    if (!accountId.trim()) throw new Error('Authenticated account is required');
    const limit = Math.max(1, Math.min(200, Math.trunc(query.limit ?? 100)));
    if (query.after !== undefined && !Number.isFinite(Date.parse(query.after))) {
      throw new Error('The after cursor must be an ISO-8601 timestamp');
    }
    if (query.afterEventId !== undefined && !/^[A-Za-z0-9._:-]{1,256}$/.test(query.afterEventId)) {
      throw new Error('The afterEventId cursor is invalid');
    }
    if (query.eventType !== undefined && !isTceRuntimeEventType(query.eventType)) {
      throw new Error('Unsupported runtime event type');
    }

    let request = this.supabase.db
      .from('tce_runtime_events')
      .select(
        'event_id,event_type,schema_version,occurred_at,producer,correlation_id,account_id,aggregate_id,sequence,data'
      )
      .eq('account_id', accountId)
      .order('occurred_at', { ascending: true })
      .order('event_id', { ascending: true })
      .limit(limit);
    if (query.after && query.afterEventId) {
      request = request.or(
        `occurred_at.gt.${query.after},and(occurred_at.eq.${query.after},event_id.gt.${query.afterEventId})`
      );
    } else if (query.after) {
      request = request.gt('occurred_at', query.after);
    }
    if (query.eventType) request = request.eq('event_type', query.eventType);

    const { data, error } = await request;
    if (error) {
      throw new ServiceUnavailableException({
        ok: false,
        error: {
          code: 'RUNTIME_EVENT_STORE_UNAVAILABLE',
          message: 'Runtime event store is unavailable',
          retryable: true,
        },
      });
    }

    const events: TceEventEnvelope<string, unknown>[] = [];
    for (const row of data ?? []) {
      const event = {
        eventId: row.event_id,
        eventType: row.event_type,
        schemaVersion: row.schema_version,
        occurredAt: row.occurred_at,
        producer: row.producer,
        correlationId: row.correlation_id,
        ...(row.account_id ? { accountId: row.account_id } : {}),
        ...(row.aggregate_id ? { aggregateId: row.aggregate_id } : {}),
        ...(row.sequence !== null ? { sequence: Number(row.sequence) } : {}),
        data: row.data,
      };
      if (!isTceRuntimeEvent(event)) continue;
      events.push(event);
    }
    return events;
  }
}
