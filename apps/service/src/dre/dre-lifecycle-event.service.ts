import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CONTRACT_TOKENS,
  TCE_EVENT_SCHEMA_VERSION,
  type TceEventPublisherPort,
  type TceRuntimeEvent,
} from '@tce/contracts';

export type DreLifecycleEventInput = Readonly<{
  campaignId: string;
  lifecycleState: string;
  aggregateId?: string;
  sequence?: number;
  reason?: string;
  occurredAt?: string;
  correlationId?: string;
  eventKey?: string;
}>;

export function createDreLifecycleEvent(
  input: DreLifecycleEventInput
): TceRuntimeEvent<'dre.campaign.updated'> {
  if (!input.campaignId.trim()) throw new Error('DRE campaignId is required');
  if (!input.lifecycleState.trim()) throw new Error('DRE lifecycleState is required');
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new Error('DRE event occurredAt must be a valid timestamp');
  }
  if (
    input.sequence !== undefined &&
    (!Number.isSafeInteger(input.sequence) || input.sequence < 0)
  ) {
    throw new Error('DRE event sequence must be a non-negative safe integer');
  }

  const aggregateId = input.aggregateId ?? input.campaignId;
  const stableKey =
    input.eventKey?.trim() || `${aggregateId}:${input.lifecycleState}:${occurredAt}`;

  return {
    eventId: `dre.campaign.updated:${input.campaignId}:${stableKey}`,
    eventType: 'dre.campaign.updated',
    schemaVersion: TCE_EVENT_SCHEMA_VERSION,
    occurredAt,
    producer: 'dre',
    correlationId: input.correlationId ?? `dre:${input.campaignId}`,
    aggregateId,
    ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
    data: {
      campaignId: input.campaignId,
      lifecycleState: input.lifecycleState,
      ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  };
}

/**
 * Mongo state transitions remain authoritative. Event publication is best-effort
 * because Mongo and the Supabase event store do not share a transaction; a
 * publish failure must not roll back or interrupt a valid DRE lifecycle change.
 */
@Injectable()
export class DreLifecycleEventService {
  private readonly logger = new Logger(DreLifecycleEventService.name);

  constructor(
    @Inject(CONTRACT_TOKENS.eventPublisher) private readonly publisher: TceEventPublisherPort
  ) {}

  async publish(input: DreLifecycleEventInput): Promise<void> {
    const event = createDreLifecycleEvent(input);
    try {
      await this.publisher.publish(event);
    } catch (error) {
      this.logger.warn(
        `Unable to publish DRE lifecycle event ${event.eventId}; Mongo state remains authoritative: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
