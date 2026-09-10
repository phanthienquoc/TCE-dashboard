import { TceSsiTradingAuthorizationAdapter } from './tce-ssi-trading-authorization.adapter';
import type { PlatformCredentialPort } from '@tce/contracts';

const context = {
  accountId: 'account-1',
  environment: 'production',
  mode: 'LIVE' as const,
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

describe('TceSsiTradingAuthorizationAdapter', () => {
  it('returns READY for a valid unexpired persisted SSI token', async () => {
    const store: PlatformCredentialPort = {
      get: async () => credentials(),
      save: async () => undefined,
    };
    const adapter = new TceSsiTradingAuthorizationAdapter(
      store,
      { db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }) } as never
    );

    const result = await adapter.ensureAuthorized(context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state).toBe('READY');
      expect(result.data.provider).toBe('ssi');
      expect(result.data.accountId).toBe('account-1');
      expect(result.data.environment).toBe('production');
      expect(result.data.expiresAt).toBeDefined();
    }
  });

  it('fails closed when the selected TCE account does not match SSI account', async () => {
    const store: PlatformCredentialPort = {
      get: async () => credentials({ accountNo: 'SSI002' }),
      save: async () => undefined,
    };
    const adapter = new TceSsiTradingAuthorizationAdapter(
      store,
      { db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }) } as never
    );

    const result = await adapter.ensureAuthorized(context);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
  });

  it('fails closed when the TCE account cannot be resolved', async () => {
    const store: PlatformCredentialPort = {
      get: async () => credentials(),
      save: async () => undefined,
    };
    const adapter = new TceSsiTradingAuthorizationAdapter(
      store,
      { db: fakeDb(null) } as never
    );

    const result = await adapter.ensureAuthorized(context);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNAVAILABLE');
  });

  it('fails closed when credential loading fails', async () => {
    const store: PlatformCredentialPort = {
      get: async () => {
        throw new Error('credential unavailable');
      },
      save: async () => undefined,
    };
    const adapter = new TceSsiTradingAuthorizationAdapter(
      store,
      { db: fakeDb({ id: 'account-1', user_id: 'user-1', external_account_no: 'SSI001' }) } as never
    );

    const result = await adapter.ensureAuthorized(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAVAILABLE');
      expect(result.error.message).toBe('credential unavailable');
    }
  });
});
