import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileOrderStates } from './order-state-reconciler';

test('matches by provider order id and converges recognized partial fill', () => {
  const [delta] = reconcileOrderStates(
    [
      {
        id: 'local-1',
        symbol: 'VNM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 20,
        status: 'SUBMITTED',
        providerOrderId: 'ssi-1',
      },
    ],
    [
      {
        providerOrderId: 'ssi-1',
        symbol: 'VNM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 50,
        status: 'PARTIAL_FILLED',
      },
    ]
  );
  assert.equal(delta.disposition, 'PARTIAL_FILL');
  assert.equal(delta.normalizedProviderState, 'PARTIALLY_FILLED');
  assert.equal(delta.providerFilledQuantity, 50);
});

test('matches by client request id when provider order id is not stored locally', () => {
  const [delta] = reconcileOrderStates(
    [
      {
        id: 'local-2',
        symbol: 'FPT',
        side: 'SELL',
        quantity: 10,
        filledQuantity: 10,
        status: 'SUBMITTED',
        clientRequestId: 'req-2',
      },
    ],
    [
      {
        providerOrderId: 'ssi-2',
        symbol: 'FPT',
        side: 'SELL',
        quantity: 10,
        filledQuantity: 10,
        status: 'FILLED',
        clientRequestId: 'req-2',
      },
    ]
  );
  assert.equal(delta.disposition, 'TERMINAL');
  assert.equal(delta.normalizedProviderState, 'FILLED');
});

test('does not mutate state for an unknown provider status', () => {
  const [delta] = reconcileOrderStates(
    [
      {
        id: 'local-3',
        symbol: 'HPG',
        side: 'BUY',
        quantity: 10,
        filledQuantity: 0,
        status: 'SUBMITTED',
        providerOrderId: 'ssi-3',
      },
    ],
    [
      {
        providerOrderId: 'ssi-3',
        symbol: 'HPG',
        side: 'BUY',
        quantity: 10,
        filledQuantity: 0,
        status: 'BROKER_NEW_STATE',
      },
    ]
  );
  assert.equal(delta.disposition, 'RECONCILIATION_REQUIRED');
  assert.equal(delta.normalizedProviderState, 'UNKNOWN');
});

test('detects missing and orphan provider orders without auto-adopting either', () => {
  const deltas = reconcileOrderStates(
    [
      {
        id: 'local-4',
        symbol: 'VCB',
        side: 'BUY',
        quantity: 5,
        filledQuantity: 0,
        status: 'SUBMITTED',
        providerOrderId: 'missing',
      },
    ],
    [
      {
        providerOrderId: 'orphan',
        symbol: 'MWG',
        side: 'SELL',
        quantity: 5,
        filledQuantity: 0,
        status: 'OPEN',
      },
    ]
  );
  assert.deepEqual(
    deltas.map(delta => delta.disposition),
    ['MISSING_PROVIDER_ORDER', 'ORPHAN_PROVIDER_ORDER']
  );
});
