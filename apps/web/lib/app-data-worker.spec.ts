import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { api } from './api';
import { useAppDataWorkerStore } from './app-data-worker';
import { useStockDividendPoolStore } from './stock-dividend-pool-store';
import { useStockEventStore } from './stock-event-store';
import { useStockSyncStore } from './stock-sync-store';
import { useTCEDataStore } from './tce-data-store';

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
  'clearing the app data worker prevents old work from advancing progress or starting more tasks',
  async () => {
    const originalGet = api.get;
    const requests: Array<{
      url: string;
      signal?: AbortSignal;
      pending: Deferred<AxiosResponse<unknown>>;
    }> = [];

    api.get = ((url: string, config?: AxiosRequestConfig) => {
      const pending = deferred<AxiosResponse<unknown>>();
      requests.push({ url, signal: config?.signal as AbortSignal | undefined, pending });
      return pending.promise;
    }) as typeof api.get;

    try {
      useAppDataWorkerStore.getState().clear();
      useTCEDataStore.getState().clear();
      useStockEventStore.getState().clear();
      useStockSyncStore.getState().clear();
      useStockDividendPoolStore.setState({ items: [], loading: false, error: null });

      const run = useAppDataWorkerStore.getState().start();
      const initialRequestCount = requests.length;
      assert.ok(initialRequestCount >= 11);

      useAppDataWorkerStore.getState().clear();
      useTCEDataStore.getState().clear();
      useStockEventStore.getState().clear();
      useStockSyncStore.getState().clear();
      assert.ok(requests.some(request => request.signal));
      assert.ok(requests.filter(request => request.signal).every(request => request.signal?.aborted));

      for (const request of requests) request.pending.resolve(response([]));
      await run;

      assert.equal(requests.length, initialRequestCount);
      assert.deepEqual(useAppDataWorkerStore.getState(), {
        status: 'idle',
        total: 0,
        completed: 0,
        failed: 0,
        startedAt: null,
        finishedAt: null,
        start: useAppDataWorkerStore.getState().start,
        clear: useAppDataWorkerStore.getState().clear,
      });
      assert.equal(useTCEDataStore.getState().initialized, false);
      assert.equal(useStockSyncStore.getState().initialized, false);
    } finally {
      useAppDataWorkerStore.getState().clear();
      useTCEDataStore.getState().clear();
      useStockEventStore.getState().clear();
      useStockSyncStore.getState().clear();
      useStockDividendPoolStore.setState({ items: [], loading: false, error: null });
      api.get = originalGet;
    }
  }
);
