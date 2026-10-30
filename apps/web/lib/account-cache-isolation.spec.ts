import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { authApi } from './api';
import { useAppDataWorkerStore } from './app-data-worker';
import { useStockEventStore } from './stock-event-store';
import { useStockSyncStore, type StockSyncRun } from './stock-sync-store';
import { useTCEDataStore } from './tce-data-store';
import { setAccessToken } from './session-token';
import { useAuthStore, useDashboardStore } from './store';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>(resolve => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: value => {
      if (!resolvePromise) throw new Error('Deferred promise has not initialized its resolver');
      resolvePromise(value);
    },
  };
}

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

test(
  'SSO account switch clears old account caches before new account prefetch starts',
  async () => {
  const originalMe = authApi.me;
  const originalPrefetch = useTCEDataStore.getState().prefetch;
  const originalStockEventLoad = useStockEventStore.getState().load;
  const originalWorkerStart = useAppDataWorkerStore.getState().start;
  const oldUser = {
    id: 'old-account',
    email: 'old@example.test',
    role: 'admin',
    mfaEnabled: false,
  };
  const newUser = {
    id: 'new-account',
    email: 'new@example.test',
    role: 'admin',
    mfaEnabled: false,
  };

  try {
    useAuthStore.setState({
      user: oldUser,
      status: 'authenticated',
      loading: false,
      initialized: true,
      error: null,
    });
    useTCEDataStore.setState({
      credentials: { telegramToken: 'old-account-secret' },
      initialized: true,
      loading: false,
    });
    useStockSyncStore.setState({
      config: {
        enabled: true,
        schedule: '0 */4 * * *',
        timezone: 'Asia/Ho_Chi_Minh',
        syncStartDate: null,
        syncEndDate: null,
        batchSize: 200,
        pageSize: 10,
        priceSyncEnabled: true,
        telegramCredentialId: 'old-account-credential',
        lastRunAt: null,
      },
      bots: [
        {
          id: 'old-account-bot',
          environment: 'production',
          name: 'private-bot',
          isActive: true,
          isPaused: false,
        },
      ],
      runs: [{ id: 'old-account-run' } as StockSyncRun],
      initialized: true,
      loading: false,
      saving: false,
      triggering: false,
      message: null,
      tab: 'config',
    });
    useDashboardStore.setState({
      data: { positions: [{ symbol: 'DPM', quantity: 100 }] },
      marketPrices: { DPM: { symbol: 'DPM', price: 42 } },
      loading: false,
      error: null,
    });

    useTCEDataStore.setState({ prefetch: async () => {} });
    useStockEventStore.setState({ load: async () => {} });
    useAppDataWorkerStore.setState({ start: async () => {} });
    authApi.me = (async () => response({ user: newUser })) as typeof authApi.me;

    await useAuthStore.getState().completeSsoLogin('new-account-access-token');

    assert.equal(useAuthStore.getState().user?.id, 'new-account');
    assert.equal(useTCEDataStore.getState().credentials, null);
    assert.equal(useTCEDataStore.getState().initialized, false);
    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.deepEqual(useStockSyncStore.getState().bots, []);
    assert.deepEqual(useStockSyncStore.getState().runs, []);
    assert.equal(useStockSyncStore.getState().initialized, false);
    assert.equal(useDashboardStore.getState().data, null);
    assert.deepEqual(useDashboardStore.getState().marketPrices, {});
    assert.equal(useAppDataWorkerStore.getState().status, 'idle');
  } finally {
    authApi.me = originalMe;
    useTCEDataStore.setState({ prefetch: originalPrefetch });
    useStockEventStore.setState({ load: originalStockEventLoad });
    useAppDataWorkerStore.setState({ start: originalWorkerStart });
    useTCEDataStore.getState().clear();
    useStockEventStore.getState().clear();
    useStockSyncStore.getState().clear();
    useDashboardStore.getState().clear();
    useAppDataWorkerStore.getState().clear();
    useAuthStore.setState({
      user: null,
      status: 'anonymous',
      loading: false,
      initialized: true,
      error: null,
    });
    setAccessToken(null);
  }
});


test('logout clears account caches before the remote logout request settles', async () => {
  const originalLogout = authApi.logout;
  const pending = deferred<AxiosResponse<unknown>>();

  authApi.logout = (() => pending.promise) as typeof authApi.logout;

  try {
    useAuthStore.setState({
      user: {
        id: 'old-account',
        email: 'old@example.test',
        role: 'admin',
        mfaEnabled: false,
      },
      status: 'authenticated',
      loading: false,
      initialized: true,
      error: null,
    });
    useTCEDataStore.setState({
      credentials: { telegramToken: 'old-account-secret' },
      initialized: true,
    });
    useStockSyncStore.setState({
      config: {
        enabled: true,
        schedule: '0 */4 * * *',
        timezone: 'Asia/Ho_Chi_Minh',
        syncStartDate: null,
        syncEndDate: null,
        batchSize: 200,
        pageSize: 10,
        priceSyncEnabled: true,
        telegramCredentialId: 'old-account-credential',
        lastRunAt: null,
      },
      bots: [
        {
          id: 'old-account-bot',
          environment: 'production',
          name: 'private-bot',
          isActive: true,
          isPaused: false,
        },
      ],
      initialized: true,
    });
    useDashboardStore.setState({
      data: { positions: [{ symbol: 'DPM', quantity: 100 }] },
      marketPrices: { DPM: { symbol: 'DPM', price: 42 } },
      loading: false,
      error: null,
    });

    const logout = useAuthStore.getState().logout();

    assert.equal(useAuthStore.getState().user, null);
    assert.equal(useAuthStore.getState().status, 'anonymous');
    assert.equal(useTCEDataStore.getState().credentials, null);
    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.deepEqual(useStockSyncStore.getState().bots, []);
    assert.equal(useDashboardStore.getState().data, null);
    assert.deepEqual(useDashboardStore.getState().marketPrices, {});
    assert.equal(useAppDataWorkerStore.getState().status, 'idle');

    pending.resolve(response({ ok: true }));
    await logout;
    assert.equal(useAuthStore.getState().user, null);
    assert.equal(useAuthStore.getState().status, 'anonymous');
  } finally {
    authApi.logout = originalLogout;
    useTCEDataStore.getState().clear();
    useStockEventStore.getState().clear();
    useStockSyncStore.getState().clear();
    useDashboardStore.getState().clear();
    useAppDataWorkerStore.getState().clear();
    useAuthStore.setState({
      user: null,
      status: 'anonymous',
      loading: false,
      initialized: true,
      error: null,
    });
    setAccessToken(null);
  }
});
