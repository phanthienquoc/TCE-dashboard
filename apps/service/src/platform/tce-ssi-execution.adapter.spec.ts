import test from 'node:test';
import assert from 'node:assert/strict';
import { TceSsiExecutionAdapter } from './tce-ssi-execution.adapter';

const command = (overrides: Record<string, unknown> = {}) => ({
  operation: 'SUBMIT' as const,
  accountId: 'account-1',
  environment: 'production',
  mode: 'LIVE' as const,
  authorization: {
    approvalId: 'approval-1',
    approvedAt: '2026-09-10T14:00:00.000Z',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
  },
  clientRequestId: 'client-1',
  intent: {
    id: 'intent-1',
    orderPlanId: 'plan-1',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    mode: 'LIVE' as const,
    symbol: 'DPM',
    side: 'BUY' as const,
    quantity: 100,
    limitPrice: 42.5,
    lifecycleState: 'READY' as const,
    createdAt: '2026-09-10T14:00:00.000Z',
  },
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

function adapter(auth = readyAuth) {
  const authorization = { ensureAuthorized: async () => auth };
  const supabase = {
    db: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: 'account-1', user_id: 'user-1' }, error: null }) }),
        }),
      }),
    },
  };
  const ssi = {
    placeOrder: async () => ({
      ok: true as const,
      data: {
        orderId: 'ssi-100',
        clientRequestId: 'client-1',
        status: 'SUBMITTED',
        confirmed: true,
        confirmedOrderId: 'ssi-100',
        providerStatus: 'RS',
      },
    }),
  };
  return new TceSsiExecutionAdapter(ssi as never, supabase as never, authorization as never);
}

test('submits an approved LIVE intent through the SSI application boundary', async () => {
  const result = await adapter().submit(command());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(result.providerOrderId, 'ssi-100');
  assert.equal(result.clientRequestId, 'client-1');
});

test('fails closed when authorization account does not match execution account', async () => {
  const result = await adapter({
    ...readyAuth,
    data: { ...readyAuth.data, accountId: 'other-account' },
  }).submit(command());
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'INVALID_ACCOUNT');
});

test('fails closed when authorization environment does not match execution environment', async () => {
  const result = await adapter({
    ...readyAuth,
    data: { ...readyAuth.data, environment: 'sandbox' },
  }).submit(command());
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'INVALID_ACCOUNT');
});

test('rejects non-LIVE commands without touching SSI', async () => {
  let called = false;
  const instance = adapter();
  (instance as any).ssi.placeOrder = async () => {
    called = true;
    throw new Error('must not execute');
  };
  const result = await instance.submit(command({ mode: 'ASSISTED' }));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'UNSUPPORTED_OPERATION');
  assert.equal(called, false);
});

test('fails closed when authorization is not READY', async () => {
  const result = await adapter({
    ok: true,
    data: {
      state: 'APPROVAL_REQUIRED',
      provider: 'ssi',
      accountId: 'account-1',
      environment: 'production',
      checkedAt: '2026-09-10T14:00:00.000Z',
    },
  }).submit(command());
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'APPROVAL_REQUIRED');
});

test('maps provider timeout to UNKNOWN-safe reconciliation result', async () => {
  const instance = adapter();
  (instance as any).ssi.placeOrder = async () => ({
    ok: false,
    error: { code: 'PROVIDER_ERROR', message: 'request timed out', retryable: false, provider: 'ssi' },
  });
  const result = await instance.submit(command());
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'TIMEOUT_UNKNOWN');
  assert.equal(result.error?.reconciliationRequired, true);
});

test('does not guess SSI CANCEL or REPLACE semantics', async () => {
  const instance = adapter();
  const cancel = await instance.cancel({
    ...command(),
    operation: 'CANCEL',
    executionIntentId: 'intent-1',
  });
  const replace = await instance.replace({
    ...command(),
    operation: 'REPLACE',
    executionIntentId: 'intent-1',
    providerOrderId: 'ssi-100',
  });
  assert.equal(cancel.error?.code, 'UNSUPPORTED_OPERATION');
  assert.equal(replace.error?.code, 'UNSUPPORTED_OPERATION');
});
