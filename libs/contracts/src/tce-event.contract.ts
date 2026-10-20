/**
 * Canonical transport-independent event envelope for TCE runtime contracts.
 *
 * REST, WebSocket and SSE adapters should carry the same envelope and payload
 * contract; only framing and connection lifecycle are transport-specific.
 */
export const TCE_EVENT_SCHEMA_VERSION = 1 as const;

export type TceEventEnvelope<TType extends string = string, TData = unknown> = Readonly<{
  /** Globally unique event identity. Preserve it across delivery retries. */
  eventId: string;
  /** Stable namespaced event name, e.g. "execution.result". */
  eventType: TType;
  /** Explicit version of the envelope/payload contract. */
  schemaVersion: typeof TCE_EVENT_SCHEMA_VERSION;
  /** ISO-8601 timestamp with an explicit UTC marker or offset. */
  occurredAt: string;
  /** Service/module producing this event. */
  producer: string;
  /** Shared identity for tracing a request/campaign/order lifecycle. */
  correlationId: string;
  /** Account scope for account-sensitive events. */
  accountId?: string;
  /** Identity of the aggregate whose state changed, if applicable. */
  aggregateId?: string;
  /** Monotonic aggregate sequence where the producer can guarantee it. */
  sequence?: number;
  /** Typed event-specific data; do not put provider-specific models here. */
  data: TData;
}>;

export type TceEventMetadata = Pick<
  TceEventEnvelope<string, unknown>,
  'eventId' | 'eventType' | 'schemaVersion' | 'occurredAt' | 'producer' | 'correlationId'
> &
  Pick<TceEventEnvelope<string, unknown>, 'accountId' | 'aggregateId' | 'sequence'>;

export type TceRuntimeEventType =
  | 'market.quote.updated'
  | 'strategy.decision.created'
  | 'risk.gate.approved'
  | 'risk.gate.blocked'
  | 'execution.intent.created'
  | 'execution.result'
  | 'execution.reconciliation.required'
  | 'account.snapshot.updated'
  | 'monitor.snapshot.created'
  | 'dre.campaign.updated';

const TCE_RUNTIME_EVENT_TYPES: readonly TceRuntimeEventType[] = [
  'market.quote.updated',
  'strategy.decision.created',
  'risk.gate.approved',
  'risk.gate.blocked',
  'execution.intent.created',
  'execution.result',
  'execution.reconciliation.required',
  'account.snapshot.updated',
  'monitor.snapshot.created',
  'dre.campaign.updated',
];

export function isTceRuntimeEventType(value: unknown): value is TceRuntimeEventType {
  return typeof value === 'string' && TCE_RUNTIME_EVENT_TYPES.includes(value as TceRuntimeEventType);
}

export type TceEventDataByType = {
  'market.quote.updated': import('./platform.contract').MarketQuote;
  'strategy.decision.created': import('./tce-auto-trade.contract').TceDecision;
  'risk.gate.approved': Readonly<{
    intentId: string;
    riskAmount: number;
    overrideApplied: boolean;
  }>;
  'risk.gate.blocked': Readonly<{ intentId: string; code: string; message: string }>;
  'execution.intent.created': import('./tce-auto-trade.contract').TceExecutionIntent;
  'execution.result': import('./tce-execution.contract').TceExecutionResult;
  'execution.reconciliation.required': Readonly<{
    executionIntentId: string;
    idempotencyKey: string;
    reason: string;
  }>;
  'account.snapshot.updated': Readonly<{
    balance?: import('./platform.contract').AccountBalance;
    positions?: readonly import('./platform.contract').AccountPosition[];
    orders?: readonly import('./platform.contract').AccountOrder[];
    observedAt: string;
  }>;
  'monitor.snapshot.created': Readonly<{
    positionId?: string;
    symbol: string;
    observedAt: string;
    signal?: string;
  }>;
  'dre.campaign.updated': Readonly<{
    campaignId: string;
    lifecycleState: string;
    sequence?: number;
    reason?: string;
  }>;
};

export type TceRuntimeEvent<TType extends TceRuntimeEventType> = TceEventEnvelope<
  TType,
  TceEventDataByType[TType]
>;

/** Provider-neutral publisher port shared by REST/WS/SSE adapters. */
export interface TceEventPublisherPort {
  publish<TType extends TceRuntimeEventType>(event: TceRuntimeEvent<TType>): Promise<void>;
}

/**
 * This validates envelope structure only. Callers must validate event-specific
 * data with its corresponding DTO/schema before treating data as trusted.
 */
export function isTceEventEnvelope(value: unknown): value is TceEventEnvelope<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  const requiredStrings = [
    'eventId',
    'eventType',
    'occurredAt',
    'producer',
    'correlationId',
  ] as const;

  if (
    !requiredStrings.every(
      key => typeof candidate[key] === 'string' && (candidate[key] as string).trim().length > 0
    )
  ) {
    return false;
  }

  if (candidate.schemaVersion !== TCE_EVENT_SCHEMA_VERSION) return false;

  const occurredAt = candidate.occurredAt as string;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) {
    return false;
  }

  if (
    candidate.accountId !== undefined &&
    (typeof candidate.accountId !== 'string' || candidate.accountId.trim().length === 0)
  ) {
    return false;
  }
  if (
    candidate.aggregateId !== undefined &&
    (typeof candidate.aggregateId !== 'string' || candidate.aggregateId.trim().length === 0)
  ) {
    return false;
  }
  if (
    candidate.sequence !== undefined &&
    (typeof candidate.sequence !== 'number' ||
      !Number.isSafeInteger(candidate.sequence) ||
      candidate.sequence < 0)
  ) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(candidate, 'data');
}
