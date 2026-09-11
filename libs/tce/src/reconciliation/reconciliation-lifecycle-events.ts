import { createHash } from 'node:crypto';
import type { ReconciliationDelta } from './order-state-reconciler';

export type TceReconciliationLifecycleEventType =
  | 'RECONCILIATION_CONVERGED'
  | 'RECONCILIATION_PARTIAL_FILL'
  | 'RECONCILIATION_TERMINAL'
  | 'RECONCILIATION_MISSING_PROVIDER_ORDER'
  | 'RECONCILIATION_ORPHAN_PROVIDER_ORDER'
  | 'RECONCILIATION_REQUIRED';

export type TceReconciliationLifecycleEvent = Readonly<{
  eventId: string;
  type: TceReconciliationLifecycleEventType;
  runId: string;
  accountId: string;
  environment: string;
  correlationId: string;
  observedAt: string;
  disposition: ReconciliationDelta['disposition'];
  localOrderId?: string;
  providerOrderId?: string;
  providerState?: string;
  providerStatus?: string;
  localStatus?: string;
  localFilledQuantity?: number;
  providerFilledQuantity?: number;
  reason: string;
}>;

export type TceReconciliationLifecycleContext = Readonly<{
  runId: string;
  accountId: string;
  environment: string;
  correlationId: string;
  observedAt: string;
}>;

const EVENT_TYPE: Readonly<
  Record<ReconciliationDelta['disposition'], TceReconciliationLifecycleEventType>
> = {
  CONVERGED: 'RECONCILIATION_CONVERGED',
  PARTIAL_FILL: 'RECONCILIATION_PARTIAL_FILL',
  TERMINAL: 'RECONCILIATION_TERMINAL',
  MISSING_PROVIDER_ORDER: 'RECONCILIATION_MISSING_PROVIDER_ORDER',
  ORPHAN_PROVIDER_ORDER: 'RECONCILIATION_ORPHAN_PROVIDER_ORDER',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
};

function identity(delta: ReconciliationDelta): string {
  return [
    delta.disposition,
    delta.localOrderId ?? '',
    delta.providerOrderId ?? '',
    delta.providerStatus ?? '',
    delta.normalizedProviderState ?? '',
    delta.providerFilledQuantity ?? '',
    delta.localFilledQuantity ?? '',
  ].join('|');
}

export function createReconciliationLifecycleEvent(
  context: TceReconciliationLifecycleContext,
  delta: ReconciliationDelta
): TceReconciliationLifecycleEvent {
  const type = EVENT_TYPE[delta.disposition];
  const eventId = createHash('sha256')
    .update(
      `${context.runId}|${context.accountId}|${context.environment}|${context.correlationId}|${identity(delta)}`
    )
    .digest('hex')
    .slice(0, 32);

  return {
    eventId,
    type,
    runId: context.runId,
    accountId: context.accountId,
    environment: context.environment,
    correlationId: context.correlationId,
    observedAt: context.observedAt,
    disposition: delta.disposition,
    localOrderId: delta.localOrderId,
    providerOrderId: delta.providerOrderId,
    providerState: delta.normalizedProviderState,
    providerStatus: delta.providerStatus,
    localStatus: delta.localStatus,
    localFilledQuantity: delta.localFilledQuantity,
    providerFilledQuantity: delta.providerFilledQuantity,
    reason: delta.reason,
  };
}

export function createReconciliationLifecycleEvents(
  context: TceReconciliationLifecycleContext,
  deltas: readonly ReconciliationDelta[]
): readonly TceReconciliationLifecycleEvent[] {
  return deltas.map(delta => createReconciliationLifecycleEvent(context, delta));
}
