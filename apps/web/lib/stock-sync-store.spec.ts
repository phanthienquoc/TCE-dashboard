import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { api } from './api';
import {
  useStockSyncStore,
  type StockSyncConfig,
  type StockSyncRun,
  type StockSyncTelegramBot,
} from './stock-sync-store';

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

function httpError(status: number, internalMessage: string): AxiosError {
  const config = {
    headers: new AxiosHeaders(),
  } as InternalAxiosRequestConfig;
  const errorResponse: AxiosResponse<{ message: string }> = {
    data: { message: internalMessage },
    status,
    statusText: status === 403 ? 'Forbidden' : 'Internal Server Error',
    headers: new AxiosHeaders(),
    config,
  };

  return new AxiosError(internalMessage, 'ERR_BAD_REQUEST', config, undefined, errorResponse);
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

test('refresh propagates caller cancellation to settings, Telegram bots, and run-history reads', async () => {
  const originalGet = api.get;
  const requests: Array<{
    url: string;
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<unknown>>;
  }> = [];
  const controller = new AbortController();

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

    const refresh = useStockSyncStore.getState().refresh(controller.signal);
    assert.equal(requests.length, 3);
    assert.ok(requests.some(request => request.url.includes('/stock-events-cron/settings')));
    assert.ok(requests.some(request => request.url.includes('/platform/telegram/bots')));
    assert.ok(requests.some(request => request.url.includes('/stock-events-cron/runs')));
    assert.ok(requests.every(request => request.signal));

    controller.abort();

    assert.ok(requests.every(request => request.signal?.aborted));

    for (const request of requests) request.pending.resolve(response({}));
    await refresh;

    const state = useStockSyncStore.getState();
    assert.equal(state.initialized, false);
    assert.equal(state.loading, false);
    assert.deepEqual(state.bots, []);
    assert.deepEqual(state.runs, []);
    assert.equal(state.config.telegramCredentialId, null);
    assert.equal(state.message, null);
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
    pending.resolve(
      response({ telegramCredentialId: 'old-account-credential' } as StockSyncConfig)
    );
    await save;

    assert.equal(useStockSyncStore.getState().config.telegramCredentialId, null);
    assert.equal(useStockSyncStore.getState().saving, false);
    assert.equal(useStockSyncStore.getState().initialized, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.post = originalPost;
  }
});

test('refresh normalizes backend errors instead of exposing internal response details', async () => {
  const originalGet = api.get;
  api.get = (async () => {
    throw httpError(403, 'internal database schema and connection detail');
  }) as typeof api.get;

  try {
    useStockSyncStore.getState().clear();
    await useStockSyncStore.getState().refresh();

    const state = useStockSyncStore.getState();
    assert.equal(state.message, 'You do not have permission to perform this action.');
    assert.equal(state.message?.includes('internal database'), false);
    assert.equal(state.loading, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.get = originalGet;
  }
});

test('save normalizes server errors without exposing raw backend details', async () => {
  const originalPost = api.post;
  api.post = (async () => {
    throw httpError(500, 'internal database schema and connection detail');
  }) as typeof api.post;

  try {
    useStockSyncStore.getState().clear();
    await useStockSyncStore.getState().save();

    const state = useStockSyncStore.getState();
    assert.equal(state.message, 'The service is temporarily unavailable. Please try again.');
    assert.equal(state.message?.includes('internal database'), false);
    assert.equal(state.saving, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.post = originalPost;
  }
});

test('trigger normalizes authorization errors without exposing raw backend details', async () => {
  const originalPost = api.post;
  api.post = (async () => {
    throw httpError(403, 'internal database schema and connection detail');
  }) as typeof api.post;

  try {
    useStockSyncStore.getState().clear();
    await useStockSyncStore.getState().trigger();

    const state = useStockSyncStore.getState();
    assert.equal(state.message, 'You do not have permission to perform this action.');
    assert.equal(state.message?.includes('internal database'), false);
    assert.equal(state.triggering, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.post = originalPost;
  }
});

test('refresh uses the safe fallback for non-Axios errors', async () => {
  const originalGet = api.get;
  api.get = (async () => {
    throw new Error('raw internal stack or connection detail');
  }) as typeof api.get;

  try {
    useStockSyncStore.getState().clear();
    await useStockSyncStore.getState().refresh();

    const state = useStockSyncStore.getState();
    assert.equal(state.message, 'Unable to load stock events cron data');
    assert.equal(state.message?.includes('raw internal'), false);
    assert.equal(state.loading, false);
  } finally {
    useStockSyncStore.getState().clear();
    api.get = originalGet;
  }
});
