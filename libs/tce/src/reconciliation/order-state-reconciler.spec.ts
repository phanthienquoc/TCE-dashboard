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

test('rejects invalid local quantities as reconciliation-required before fill classification', () => {
  const invalidQuantities = [
    [0, 0],
    [10, -1],
    [10, 11],
    [Number.NaN, 0],
    [10, Number.POSITIVE_INFINITY],
  ] as const;

  for (const [quantity, filledQuantity] of invalidQuantities) {
    const [delta] = reconcileOrderStates(
      [
        {
          id: 'local-invalid',
          symbol: 'VNM',
          side: 'BUY',
          quantity,
          filledQuantity,
          status: 'SUBMITTED',
          providerOrderId: 'ssi-invalid',
        },
      ],
      [
        {
          providerOrderId: 'ssi-invalid',
          symbol: 'VNM',
          side: 'BUY',
          quantity: 10,
          filledQuantity: 0,
          status: 'PARTIAL_FILLED',
        },
      ]
    );
    assert.equal(delta.disposition, 'RECONCILIATION_REQUIRED');
  }
});

test('rejects invalid provider quantities as reconciliation-required before fill classification', () => {
  const invalidQuantities = [
    [0, 0],
    [10, -1],
    [10, 11],
    [Number.NEGATIVE_INFINITY, 0],
    [10, Number.NaN],
  ] as const;

  for (const [quantity, filledQuantity] of invalidQuantities) {
    const [delta] = reconcileOrderStates(
      [
        {
          id: 'local-valid',
          symbol: 'VNM',
          side: 'BUY',
          quantity: 10,
          filledQuantity: 0,
          status: 'SUBMITTED',
          providerOrderId: 'ssi-invalid',
        },
      ],
      [
        {
          providerOrderId: 'ssi-invalid',
          symbol: 'VNM',
          side: 'BUY',
          quantity,
          filledQuantity,
          status: 'PARTIAL_FILLED',
        },
      ]
    );
    assert.equal(delta.disposition, 'RECONCILIATION_REQUIRED');
  }
});

test('invalid quantities on unmatched orders are not mislabeled missing or orphan orders', () => {
  const [localDelta] = reconcileOrderStates(
    [
      {
        id: 'local-invalid',
        symbol: 'VNM',
        side: 'BUY',
        quantity: 2,
        filledQuantity: 3,
        status: 'SUBMITTED',
        providerOrderId: 'missing',
      },
    ],
    []
  );
  assert.equal(localDelta.disposition, 'RECONCILIATION_REQUIRED');

  const [providerDelta] = reconcileOrderStates(
    [],
    [
      {
        providerOrderId: 'ssi-invalid',
        symbol: 'VNM',
        side: 'BUY',
        quantity: 2,
        filledQuantity: 3,
        status: 'OPEN',
      },
    ]
  );
  assert.equal(providerDelta.disposition, 'RECONCILIATION_REQUIRED');
});

test('fails closed when multiple provider orders match one local order identity', () => {
  const duplicateProviderId = reconcileOrderStates(
    [
      {
        id: 'local-duplicate',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 0,
        status: 'SUBMITTED',
        providerOrderId: 'ssi-duplicate',
      },
    ],
    [
      {
        providerOrderId: 'ssi-duplicate',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 20,
        status: 'PARTIALLY_FILLED',
      },
      {
        providerOrderId: 'ssi-duplicate',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 40,
        status: 'PARTIALLY_FILLED',
      },
    ]
  );

  assert.equal(duplicateProviderId.length, 1);
  assert.equal(duplicateProviderId[0]?.disposition, 'RECONCILIATION_REQUIRED');
  assert.match(duplicateProviderId[0]?.reason ?? '', /ambiguous/i);

  const duplicateClientRequestId = reconcileOrderStates(
    [
      {
        id: 'local-request',
        symbol: 'FPT',
        side: 'SELL',
        quantity: 10,
        filledQuantity: 0,
        status: 'SUBMITTED',
        clientRequestId: 'client-duplicate',
      },
    ],
    [
      {
        providerOrderId: 'ssi-a',
        clientRequestId: 'client-duplicate',
        symbol: 'FPT',
        side: 'SELL',
        quantity: 10,
        filledQuantity: 3,
        status: 'PARTIALLY_FILLED',
      },
      {
        providerOrderId: 'ssi-b',
        clientRequestId: 'client-duplicate',
        symbol: 'FPT',
        side: 'SELL',
        quantity: 10,
        filledQuantity: 5,
        status: 'PARTIALLY_FILLED',
      },
    ]
  );

  assert.equal(duplicateClientRequestId.length, 1);
  assert.equal(duplicateClientRequestId[0]?.disposition, 'RECONCILIATION_REQUIRED');
  assert.match(duplicateClientRequestId[0]?.reason ?? '', /ambiguous/i);
});

test('fails closed when one provider order matches multiple local orders', () => {
  const deltas = reconcileOrderStates(
    [
      {
        id: 'local-provider-id',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 0,
        status: 'SUBMITTED',
        providerOrderId: 'ssi-shared',
      },
      {
        id: 'local-client-request',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 10,
        status: 'SUBMITTED',
        clientRequestId: 'request-shared',
      },
    ],
    [
      {
        providerOrderId: 'ssi-shared',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 30,
        status: 'PARTIALLY_FILLED',
        clientRequestId: 'request-shared',
      },
    ]
  );

  assert.equal(deltas.length, 2);
  assert.deepEqual(
    deltas.map(delta => delta.disposition),
    ['RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED']
  );
  assert.ok(deltas.every(delta => /multiple local orders/i.test(delta.reason)));
});


test('fails closed for provider rows in an ambiguous local identity graph without duplicate orphan deltas', () => {
  const deltas = reconcileOrderStates(
    [
      {
        id: 'local-ambiguous',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 0,
        status: 'SUBMITTED',
        providerOrderId: 'ssi-shared',
        clientRequestId: 'request-shared',
      },
      {
        id: 'local-secondary',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 0,
        status: 'SUBMITTED',
        clientRequestId: 'request-shared',
      },
    ],
    [
      {
        providerOrderId: 'ssi-shared',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 20,
        status: 'PARTIALLY_FILLED',
      },
      {
        providerOrderId: 'ssi-extra',
        symbol: 'DPM',
        side: 'BUY',
        quantity: 100,
        filledQuantity: 40,
        status: 'PARTIALLY_FILLED',
        clientRequestId: 'request-shared',
      },
    ]
  );

  assert.equal(deltas.filter(delta => delta.providerOrderId === 'ssi-extra').length, 0);
  assert.equal(
    deltas.filter(delta => delta.localOrderId === 'local-secondary').length,
    1
  );
  assert.equal(
    deltas.find(delta => delta.localOrderId === 'local-secondary')?.disposition,
    'RECONCILIATION_REQUIRED'
  );
});

