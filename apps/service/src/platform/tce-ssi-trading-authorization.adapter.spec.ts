import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapSsiApprovalChallenge,
  mapSsiAuthorizationFailure,
  TceSsiTradingAuthorizationAdapter,
} from './tce-ssi-trading-authorization.adapter';
import type { PlatformCredentialPort } from '@tce/contracts';

const context = {
  accountId: 'account-1',
  environment: 'production',
  mode: 'LIVE' as const,
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
};

const credentials = (overrides: Record<string, unknown> = {}) => ({
  apiKey: 'key',
  apiSecret: 'secret',
  clientId: 'client',
  accountNo: 'SSI001',
  accessToken: 'access',
  tokenType: 'Bearer',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  refreshToken: 'refresh',
  refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 7200,
  ...overrides,
});

const fakeDb = (account: Record<string, unknown> | null, error: Error | null = null) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: account, error }),
      }),
    }),
  }),
});

test('maps SSI reauthentication requirement to approval-required', () => {
  const result = mapSsiAuthorizationFailure(context, 'SSI_REAUTH_REQUIRED: refresh token expired');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.state, 'APPROVAL_REQUIRED');
});

test('maps an expired provider token response to expired', () => {
  const result = mapSsiAuthorizationFailure(context, 'HTTP 401: access token expired');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.state, 'EXPIRED');
});

test('fails closed for unknown authorization failures', () => {
  const result = mapSsiAuthorizationFailure(context, 'SSI credential rejected');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'UNAVAILABLE');
    assert.equal(result.error.retryable, true);
  }
});

test('returns READY for a valid unexpired persisted SSI token', async () => {
  const store: PlatformCredentialPort = {
    get: async () => credentials(),
    save: async () => undefined,
  };
  const adapter = new TceSsiTradingAuthorizationAdapter(store, {
    db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }),
  } as never);

  const result = await adapter.ensureAuthorized(context);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.state, 'READY');
    assert.equal(result.data.provider, 'ssi');
    assert.equal(result.data.accountId, 'account-1');
    assert.equal(result.data.environment, 'production');
    assert.ok(result.data.expiresAt);
  }
});

test('fails closed when the selected TCE account does not match SSI account', async () => {
  const store: PlatformCredentialPort = {
    get: async () => credentials({ accountNo: 'SSI002' }),
    save: async () => undefined,
  };
  const adapter = new TceSsiTradingAuthorizationAdapter(store, {
    db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }),
  } as never);

  const result = await adapter.ensureAuthorized(context);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'UNAVAILABLE');
});

test('fails closed when the TCE account cannot be resolved', async () => {
  const store: PlatformCredentialPort = {
    get: async () => credentials(),
    save: async () => undefined,
  };
  const adapter = new TceSsiTradingAuthorizationAdapter(store, { db: fakeDb(null) } as never);

  const result = await adapter.ensureAuthorized(context);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'UNAVAILABLE');
});

test('fails closed when credential loading fails', async () => {
  const store: PlatformCredentialPort = {
    get: async () => {
      throw new Error('credential unavailable');
    },
    save: async () => undefined,
  };
  const adapter = new TceSsiTradingAuthorizationAdapter(store, {
    db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }),
  } as never);

  const result = await adapter.ensureAuthorized(context);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'UNAVAILABLE');
    assert.equal(result.error.message, 'credential unavailable');
  }
});

test('keeps approval metadata provider-neutral and excludes credential material', () => {
  const result = mapSsiApprovalChallenge(context, {
    transactionId: 'tx-123',
    message: 'Open the SSI app and approve the sign-in request.',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.state, 'APPROVAL_REQUIRED');
    assert.equal(result.data.transactionId, 'tx-123');
    assert.equal(result.data.approvalAction, 'APPROVE_OR_ENTER_OTP');
    assert.match(result.data.approvalMessage, /approve/);
    assert.equal(JSON.stringify(result.data).includes('apiSecret'), false);
    assert.equal(JSON.stringify(result.data).includes('accessToken'), false);
  }
});
