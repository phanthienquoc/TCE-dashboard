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

const endpointNames = [
  'dashboard',
  'engines',
  'engineConfig',
  'credentials',
  'telegramBots',
  'telegramAssignments',
] as const;
type EndpointName = (typeof endpointNames)[number];

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
      const poolRequest = requests.find(request => request.url.includes('/stock-events/pool'));
      assert.ok(poolRequest, 'worker must start the dividend-pool read');
      assert.ok(poolRequest.signal, 'dividend-pool read must receive a cancellable signal');
      const stockEventRequest = requests.find(request => request.url === '/stock-events');
      assert.ok(stockEventRequest, 'worker must start the stock-event read');
      assert.ok(stockEventRequest.signal, 'stock-event read must receive a cancellable signal');
      assert.ok(requests.some(request => request.signal));
      assert.ok(requests.filter(request => request.signal).every(request => request.signal?.aborted));
      assert.equal(poolRequest.signal?.aborted, true);
      assert.equal(stockEventRequest.signal?.aborted, true);

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

test(
  'app data worker logs normalized error metadata without raw Axios secrets or response bodies',
  async () => {
    const originalGet = api.get;
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    const config = {
      headers: new AxiosHeaders({ Authorization: 'Bearer worker-test-secret' }),
    } as InternalAxiosRequestConfig;
    const failedResponse: AxiosResponse<unknown> = {
      data: { message: 'private database connection string' },
      status: 500,
      statusText: 'Internal Server Error',
      headers: new AxiosHeaders(),
      config,
    };
    const error = new AxiosError(
      'Request failed with status code 500',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      failedResponse
    );

    api.get = (() => Promise.reject(error)) as typeof api.get;
    console.warn = ((...args: unknown[]) => {
      warnings.push(args);
    }) as typeof console.warn;

    try {
      useAppDataWorkerStore.getState().clear();
      useTCEDataStore.getState().clear();
      useStockEventStore.getState().clear();
      useStockSyncStore.getState().clear();
      useStockDividendPoolStore.setState({ items: [], loading: false, error: null });

      await useAppDataWorkerStore.getState().start();

      assert.ok(warnings.length > 0, 'failed worker reads should remain observable');
      assert.ok(
        warnings.every(
          args =>
            args.length === 2 &&
            typeof args[0] === 'string' &&
            typeof args[1] === 'object' &&
            args[1] !== null
        ),
        'warnings should contain a message and sanitized metadata, not the raw error object'
      );
      const output = JSON.stringify(warnings);
      assert.equal(output.includes('worker-test-secret'), false);
      assert.equal(output.includes('private database connection string'), false);
      assert.equal(output.includes('ERR_BAD_RESPONSE'), false);
      assert.ok(
        warnings.some(args => {
          const metadata = args[1] as Record<string, unknown>;
          return metadata.kind === 'http' && metadata.status === 500;
        }),
        'sanitized logs should retain safe failure kind and HTTP status'
      );
      assert.ok(useAppDataWorkerStore.getState().failed > 0);
    } finally {
      useAppDataWorkerStore.getState().clear();
      useTCEDataStore.getState().clear();
      useStockEventStore.getState().clear();
      useStockSyncStore.getState().clear();
      useStockDividendPoolStore.setState({ items: [], loading: false, error: null });
      api.get = originalGet;
      console.warn = originalWarn;
    }
  }
);
