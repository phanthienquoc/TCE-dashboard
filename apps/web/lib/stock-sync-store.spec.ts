import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { api } from './api';
import { useStockSyncStore, type StockSyncConfig, type StockSyncRun, type StockSyncTelegramBot } from './stock-sync-store';

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

test('clear aborts account-scoped reads and blocks late responses from restoring old data', async () => {
  const originalGet = api.get;
  const requests: Array<{
    url: string;
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<unknown>>;
  }> = [];

  api.get = ((url: string, config?: AxiosRequestConfig) => {
    const pending = deferred<AxiosResponse<unknown>>();
    requests.push({
      url,
      signal: config?.signal as AbortSignal | undefined,
      pending,
    });
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockSyncStore.getState().clear();
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

    const refresh = useStockSyncStore.getState().refresh();
    assert.equal(requests.length, 3);
    assert.ok(requests.every(request => request.signal));

    useStockSyncStore.getState().clear();

    assert.ok(requests.every(request => request.signal?.aborted));
    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.deepEqual(useStockSyncStore.getState().bots, []);
    assert.deepEqual(useStockSyncStore.getState().runs, []);
    assert.equal(useStockSyncStore.getState().initialized, false);
    assert.equal(useStockSyncStore.getState().loading, false);

    for (const request of requests) {
      if (request.url.includes('/stock-events-cron/settings')) {
        request.pending.resolve(
          response({
            telegramCredentialId: 'old-account-credential',
          } as StockSyncConfig)
        );
      } else if (request.url.includes('/platform/telegram/bots')) {
        request.pending.resolve(
          response([
            {
              id: 'old-account-bot',
              environment: 'production',
              name: 'private-bot',
              isActive: true,
              isPaused: false,
            } as StockSyncTelegramBot,
          ])
        );
      } else {
        request.pending.resolve(response([{ id: 'old-account-run' } as StockSyncRun]));
      }
    }

    await refresh;

    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.deepEqual(useStockSyncStore.getState().bots, []);
    assert.deepEqual(useStockSyncStore.getState().runs, []);
    assert.equal(useStockSyncStore.getState().initialized, false);
    assert.equal(useStockSyncStore.getState().loading, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.get = originalGet;
  }
});

test('clear prevents a late save response from restoring previous-account configuration', async () => {
  const originalPost = api.post;
  const pending = deferred<AxiosResponse<StockSyncConfig>>();

  api.post = (() => pending.promise) as typeof api.post;

  try {
    useStockSyncStore.getState().clear();
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
      saving: false,
      initialized: true,
    });

    const save = useStockSyncStore.getState().save();
    useStockSyncStore.getState().clear();
    pending.resolve(response({ telegramCredentialId: 'old-account-credential' } as StockSyncConfig));
    await save;

    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.equal(useStockSyncStore.getState().saving, false);
    assert.equal(useStockSyncStore.getState().initialized, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.post = originalPost;
  }
});
