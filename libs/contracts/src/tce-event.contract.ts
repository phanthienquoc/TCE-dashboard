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
  return (
    typeof value === 'string' && TCE_RUNTIME_EVENT_TYPES.includes(value as TceRuntimeEventType)
  );
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


type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPositiveNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value > 0;

const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
  Number.isFinite(Date.parse(value));

const isPlatformKind = (value: unknown): boolean =>
  value === 'ssi' ||
  value === 'binance' ||
  value === 'fastapi' ||
  value === 'supabase' ||
  value === 'telegram';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

function isMarketQuote(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.symbol) &&
    isPositiveNumber(value.price) &&
    isTimestamp(value.timestamp) &&
    isPlatformKind(value.source)
  );
}

function isStrategyDecision(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.candidateId) &&
    isNonEmptyString(value.symbol) &&
    ['BUY', 'HOLD', 'REJECT'].includes(String(value.action)) &&
    ['A', 'B', 'C'].includes(String(value.pool)) &&
    isNonEmptyString(value.slotId) &&
    isPositiveNumber(value.entry) &&
    isPositiveNumber(value.target) &&
    (value.invalidation === undefined || isPositiveNumber(value.invalidation)) &&
    isFiniteNumber(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    isStringArray(value.reasons) &&
    isNonEmptyString(value.strategyVersion) &&
    isTimestamp(value.decidedAt)
  );
}

function isExecutionIntent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.orderPlanId) &&
    isNonEmptyString(value.correlationId) &&
    isNonEmptyString(value.idempotencyKey) &&
    ['PAPER', 'ASSISTED', 'LIVE'].includes(String(value.mode)) &&
    isNonEmptyString(value.symbol) &&
    (value.side === 'BUY' || value.side === 'SELL') &&
    isPositiveNumber(value.quantity) &&
    (value.limitPrice === undefined || isPositiveNumber(value.limitPrice)) &&
    ['READY', 'EXIT_READY'].includes(String(value.lifecycleState)) &&
    isTimestamp(value.createdAt)
  );
}

function isExecutionResult(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.ok !== 'boolean' ||
    !['SUBMIT', 'CANCEL', 'REPLACE'].includes(String(value.operation)) ||
    !['SUBMITTED', 'CANCELLED', 'REPLACED', 'PENDING', 'REJECTED', 'UNKNOWN'].includes(
      String(value.status)
    ) ||
    !isNonEmptyString(value.executionIntentId) ||
    !isNonEmptyString(value.correlationId) ||
    !isNonEmptyString(value.idempotencyKey) ||
    !isNonEmptyString(value.clientRequestId)
  ) return false;

  if (value.providerOrderId !== undefined && !isNonEmptyString(value.providerOrderId)) return false;
  if (value.filledQuantity !== undefined && !isNonNegativeNumber(value.filledQuantity)) return false;
  if (value.providerStatus !== undefined && !isNonEmptyString(value.providerStatus)) return false;
  if (value.error !== undefined) {
    if (
      !isRecord(value.error) ||
      !isNonEmptyString(value.error.code) ||
      !isNonEmptyString(value.error.message) ||
      typeof value.error.retryable !== 'boolean' ||
      typeof value.error.reconciliationRequired !== 'boolean'
    ) return false;
    if (value.error.providerCode !== undefined && !isNonEmptyString(value.error.providerCode)) {
      return false;
    }
  }
  return true;
}

function isAccountBalance(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.cash) &&
    isFiniteNumber(value.equity) &&
    isFiniteNumber(value.withdrawable) &&
    isPlatformKind(value.source) &&
    (value.accountNo === undefined || isNonEmptyString(value.accountNo))
  );
}

function isAccountPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.symbol) &&
    isFiniteNumber(value.quantity) &&
    isFiniteNumber(value.averagePrice) &&
    isPlatformKind(value.source) &&
    (value.marketPrice === undefined || isFiniteNumber(value.marketPrice)) &&
    (value.marketValue === undefined || isFiniteNumber(value.marketValue)) &&
    (value.accountId === undefined || isNonEmptyString(value.accountId)) &&
    (value.accountNo === undefined || isNonEmptyString(value.accountNo))
  );
}

function isAccountOrder(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.externalId) &&
    isNonEmptyString(value.symbol) &&
    (value.side === 'BUY' || value.side === 'SELL') &&
    isNonNegativeNumber(value.quantity) &&
    isNonEmptyString(value.status) &&
    isPlatformKind(value.source) &&
    (value.filledQuantity === undefined || isNonNegativeNumber(value.filledQuantity)) &&
    (value.clientRequestId === undefined || isNonEmptyString(value.clientRequestId))
  );
}

function isAccountSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    isTimestamp(value.observedAt) &&
    (value.balance === undefined || isAccountBalance(value.balance)) &&
    (value.positions === undefined ||
      (Array.isArray(value.positions) && value.positions.every(isAccountPosition))) &&
    (value.orders === undefined ||
      (Array.isArray(value.orders) && value.orders.every(isAccountOrder)))
  );
}

function isRuntimeEventPayload(eventType: TceRuntimeEventType, data: unknown): boolean {
  switch (eventType) {
    case 'market.quote.updated':
      return isMarketQuote(data);
    case 'strategy.decision.created':
      return isStrategyDecision(data);
    case 'risk.gate.approved':
      return (
        isRecord(data) &&
        isNonEmptyString(data.intentId) &&
        isNonNegativeNumber(data.riskAmount) &&
        typeof data.overrideApplied === 'boolean'
      );
    case 'risk.gate.blocked':
      return (
        isRecord(data) &&
        isNonEmptyString(data.intentId) &&
        isNonEmptyString(data.code) &&
        isNonEmptyString(data.message)
      );
    case 'execution.intent.created':
      return isExecutionIntent(data);
    case 'execution.result':
      return isExecutionResult(data);
    case 'execution.reconciliation.required':
      return (
        isRecord(data) &&
        isNonEmptyString(data.executionIntentId) &&
        isNonEmptyString(data.idempotencyKey) &&
        isNonEmptyString(data.reason)
      );
    case 'account.snapshot.updated':
      return isAccountSnapshot(data);
    case 'monitor.snapshot.created':
      return (
        isRecord(data) &&
        isNonEmptyString(data.symbol) &&
        isTimestamp(data.observedAt) &&
        (data.positionId === undefined || isNonEmptyString(data.positionId)) &&
        (data.signal === undefined || isNonEmptyString(data.signal))
      );
    case 'dre.campaign.updated':
      return (
        isRecord(data) &&
        isNonEmptyString(data.campaignId) &&
        isNonEmptyString(data.lifecycleState) &&
        (data.sequence === undefined ||
          (typeof data.sequence === 'number' &&
            Number.isSafeInteger(data.sequence) &&
            data.sequence >= 0)) &&
        (data.reason === undefined || isNonEmptyString(data.reason))
      );
  }
}

/** Validates the envelope, known event type, and event-specific payload at runtime. */
export function isTceRuntimeEvent(value: unknown): value is TceRuntimeEvent<TceRuntimeEventType> {
  if (!isTceEventEnvelope(value) || !isTceRuntimeEventType(value.eventType)) return false;
  return isRuntimeEventPayload(value.eventType, value.data);
}
