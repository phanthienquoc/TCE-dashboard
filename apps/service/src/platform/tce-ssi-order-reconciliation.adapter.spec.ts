import test from 'node:test';
import assert from 'node:assert/strict';
import { TceSsiOrderReconciliationAdapter } from './tce-ssi-order-reconciliation.adapter';

const query = (overrides: Record<string, unknown> = {}) => ({
  accountId: 'account-1',
  environment: 'production',
  correlationId: 'corr-1',
  requestedAt: '2026-09-10T14:00:00.000Z',
  ...overrides,
});

const readyAuth = {
  ok: true as const,
  data: {
    state: 'READY' as const,
    provider: 'ssi' as const,
    accountId: 'account-1',
    environment: 'production',
    checkedAt: '2026-09-10T14:00:00.000Z',
  },
};

function adapter(
  orders = [
    {
      accountNo: '123456',
      externalId: 'ssi-100',
      clientRequestId: 'client-1',
      symbol: 'DPM',
      side: 'BUY' as const,
      quantity: 100,
      osQuantity: 100,
      filledQuantity: 0,
      cancelQuantity: 0,
      price: 42.5,
      avgPrice: 0,
      status: 'RS',
      createdAt: '2026-09-10T14:00:00.000Z',
      modifyTime: '2026-09-10T14:00:00.000Z',
      source: 'ssi' as const,
      raw: {},
    },
  ]
) {
  const authorization = { ensureAuthorized: async () => readyAuth };
  const supabase = {
    db: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'account-1', user_id: 'user-1' },
              error: null,
            }),
          }),
        }),
      }),
    },
  };
  const ssi = {
    current: async () => ({
      ok: true as const,
      data: { orders },
    }),
  };
  return new TceSsiOrderReconciliationAdapter(
    ssi as never,
    supabase as never,
    authorization as never
  );
}

test('maps SSI open order through provider-neutral reconciliation boundary', async () => {
  const result = await adapter().listOpenOrders(query());
  assert.equal(result.ok, true);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0]?.providerOrderId, 'ssi-100');
  assert.equal(result.orders[0]?.state, 'SUBMITTED');
  assert.equal(result.orders[0]?.providerStatus, 'RS');
});

test('fails closed on account/environment authorization mismatch', async () => {
  const authorization = {
    ensureAuthorized: async () => ({
      ...readyAuth,
      data: { ...readyAuth.data, accountId: 'other-account' },
    }),
  };
  const instance = new TceSsiOrderReconciliationAdapter(
    {
      current: async () => {
        throw new Error('must not read SSI');
      },
    } as never,
    {
      db: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'account-1', user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        }),
      },
    } as never,
    authorization as never
  );
  const result = await instance.listOpenOrders(query());
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'INVALID_QUERY');
});

test('unknown provider status is surfaced separately and never treated as open', async () => {
  const result = await adapter([
    {
      accountNo: '123456',
      externalId: 'ssi-unknown',
      symbol: 'DPM',
      side: 'BUY',
      quantity: 100,
      osQuantity: 100,
      filledQuantity: 0,
      cancelQuantity: 0,
      price: 42.5,
      avgPrice: 0,
      status: 'BROKER_NEW_STATE',
      createdAt: '2026-09-10T14:00:00.000Z',
      source: 'ssi',
      raw: {},
    },
  ]).listOpenOrders(query());
  assert.equal(result.ok, true);
  assert.equal(result.orders.length, 0);
  assert.equal(result.unknownProviderOrders.length, 1);
  assert.equal(result.unknownProviderOrders[0]?.state, 'UNKNOWN');
});

test('getOrder isolates the requested provider order', async () => {
  const result = await adapter().getOrder(query(), 'ssi-100');
  assert.equal(result.ok, true);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0]?.providerOrderId, 'ssi-100');
});

test('rejects malformed reconciliation queries before provider access', async () => {
  let called = false;
  const instance = adapter();
  (instance as any).ssi.current = async () => {
    called = true;
    throw new Error('must not execute');
  };
  const result = await instance.listOpenOrders(query({ requestedAt: 'not-a-date' }));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'INVALID_QUERY');
  assert.equal(called, false);
});
