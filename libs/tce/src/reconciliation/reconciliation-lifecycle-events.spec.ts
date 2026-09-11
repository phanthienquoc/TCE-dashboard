import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReconciliationLifecycleEvent,
  createReconciliationLifecycleEvents,
} from './reconciliation-lifecycle-events';

const context = {
  runId: 'run-1',
  accountId: 'account-1',
  environment: 'LIVE',
  correlationId: 'corr-1',
  observedAt: '2026-09-11T00:00:00.000Z',
};

const delta = {
  localOrderId: 'local-1',
  providerOrderId: 'ssi-1',
  disposition: 'PARTIAL_FILL' as const,
  localStatus: 'SUBMITTED',
  providerStatus: 'PARTIAL_FILLED',
  normalizedProviderState: 'PARTIALLY_FILLED' as const,
  localFilledQuantity: 20,
  providerFilledQuantity: 50,
  reason: 'Provider fill quantity is authoritative for reconciliation.',
};

test('creates a deterministic lifecycle event for a reconciliation delta', () => {
  const first = createReconciliationLifecycleEvent(context, delta);
  const second = createReconciliationLifecycleEvent(context, delta);

  assert.deepEqual(second, first);
  assert.match(first.eventId, /^[0-9a-f]{32}$/);
  assert.equal(first.type, 'RECONCILIATION_PARTIAL_FILL');
  assert.equal(first.runId, 'run-1');
  assert.equal(first.accountId, 'account-1');
  assert.equal(first.environment, 'LIVE');
  assert.equal(first.providerState, 'PARTIALLY_FILLED');
});

test('changes identity when reconciliation delta identity changes', () => {
  const first = createReconciliationLifecycleEvent(context, delta);
  const changed = createReconciliationLifecycleEvent(context, {
    ...delta,
    providerFilledQuantity: 60,
  });

  assert.notEqual(changed.eventId, first.eventId);
});

test('maps every reconciliation disposition to an explicit lifecycle event type', () => {
  const dispositions = [
    'CONVERGED',
    'PARTIAL_FILL',
    'TERMINAL',
    'MISSING_PROVIDER_ORDER',
    'ORPHAN_PROVIDER_ORDER',
    'RECONCILIATION_REQUIRED',
  ] as const;

  const events = createReconciliationLifecycleEvents(
    context,
    dispositions.map(disposition => ({ disposition, reason: disposition })),
  );

  assert.deepEqual(
    events.map(event => event.type),
    [
      'RECONCILIATION_CONVERGED',
      'RECONCILIATION_PARTIAL_FILL',
      'RECONCILIATION_TERMINAL',
      'RECONCILIATION_MISSING_PROVIDER_ORDER',
      'RECONCILIATION_ORPHAN_PROVIDER_ORDER',
      'RECONCILIATION_REQUIRED',
    ],
  );
});

test('preserves fail-closed orphan and missing semantics without adding mutation instructions', () => {
  const events = createReconciliationLifecycleEvents(context, [
    { disposition: 'ORPHAN_PROVIDER_ORDER', providerOrderId: 'orphan', reason: 'No local order.' },
    { disposition: 'MISSING_PROVIDER_ORDER', localOrderId: 'missing', reason: 'No provider order.' },
    { disposition: 'RECONCILIATION_REQUIRED', localOrderId: 'unknown', reason: 'Unknown provider state.' },
  ]);

  assert.equal(events[0]?.type, 'RECONCILIATION_ORPHAN_PROVIDER_ORDER');
  assert.equal(events[1]?.type, 'RECONCILIATION_MISSING_PROVIDER_ORDER');
  assert.equal(events[2]?.type, 'RECONCILIATION_REQUIRED');
  assert.equal(JSON.stringify(events).includes('resubmit'), false);
  assert.equal(JSON.stringify(events).includes('adopt'), false);
});
