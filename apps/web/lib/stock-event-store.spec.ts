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
import { useStockEventStore, type StockEvent } from './stock-event-store';

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

function stockEvent(id: string): StockEvent {
  return {
    id,
    ticker: 'DPM',
    exDividendDate: '2026-11-15',
    exDividendTimestamp: '2026-11-15T00:00:00.000Z',
    executionDate: null,
    eventContent: 'Cash dividend',
    dividendRate: '10%',
    dividendValue: 100,
    price: 25,
    currentPrice: 26,
    currentPriceDate: '2026-11-14',
    dividendYieldPct: 4,
    oneYearLow: 20,
    oneYearHigh: 30,
  };
}

// Resolve the mock even after abort so the store's generation guard is verified independently of Axios.
test('clear aborts the in-flight stock-event read and ignores its late response', async () => {
  const originalGet = api.get;
  const pending = deferred<AxiosResponse<unknown>>();
  let requestSignal: AbortSignal | undefined;

  api.get = ((_: string, config?: AxiosRequestConfig) => {
    requestSignal = config?.signal as AbortSignal | undefined;
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockEventStore.getState().clear();
    const load = useStockEventStore.getState().load(200, false, null);

    assert.equal(requestSignal?.aborted, false);
    useStockEventStore.getState().clear();
    assert.equal(requestSignal?.aborted, true);

    pending.resolve(response([stockEvent('stale')]));
    await load;

    const state = useStockEventStore.getState();
    assert.deepEqual(state.events, []);
    assert.equal(state.initialized, false);
    assert.equal(state.loading, false);
    assert.equal(state.error, null);
  } finally {
    useStockEventStore.getState().clear();
    api.get = originalGet;
  }
});

test('worker cancellation aborts the stock-event transport without surfacing an error', async () => {
  const originalGet = api.get;
  const pending = deferred<AxiosResponse<unknown>>();
  let requestSignal: AbortSignal | undefined;
  const existing = [stockEvent('existing')];

  api.get = ((_: string, config?: AxiosRequestConfig) => {
    requestSignal = config?.signal as AbortSignal | undefined;
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockEventStore.setState({
      events: existing,
      loading: false,
      initialized: true,
      error: null,
    });
    const worker = new AbortController();
    const load = useStockEventStore.getState().load(200, true, null, worker.signal);

    assert.equal(requestSignal?.aborted, false);
    worker.abort();
    assert.equal(requestSignal?.aborted, true);

    pending.resolve(response([stockEvent('late')]));
    await load;

    const state = useStockEventStore.getState();
    assert.deepEqual(state.events, existing);
    assert.equal(state.initialized, true);
    assert.equal(state.loading, false);
    assert.equal(state.error, null);
  } finally {
    useStockEventStore.getState().clear();
    api.get = originalGet;
  }
});

// The first caller owns the transport; a waiting caller can cancel only its own wait.
test('aborting a waiting caller does not abort the shared stock-event transport', async () => {
  const originalGet = api.get;
  const pending = deferred<AxiosResponse<unknown>>();
  let requestSignal: AbortSignal | undefined;
  let requestCount = 0;

  api.get = ((_: string, config?: AxiosRequestConfig) => {
    requestCount += 1;
    requestSignal = config?.signal as AbortSignal | undefined;
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockEventStore.getState().clear();
    const ownerLoad = useStockEventStore.getState().load(200, true, null);
    assert.equal(requestCount, 1);

    const waitingCaller = new AbortController();
    const waitingLoad = useStockEventStore.getState().load(200, true, null, waitingCaller.signal);
    waitingCaller.abort();
    await waitingLoad;

    assert.equal(requestSignal?.aborted, false);
    assert.equal(requestCount, 1);

    pending.resolve(response([stockEvent('shared')]));
    await ownerLoad;

    assert.equal(requestSignal?.aborted, false);
    assert.deepEqual(
      useStockEventStore.getState().events.map(event => event.id),
      ['shared']
    );
  } finally {
    useStockEventStore.getState().clear();
    api.get = originalGet;
  }
});

test('a waiting stock-event caller retries when the transport owner aborts', async () => {
  const originalGet = api.get;
  const requests: Array<{
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<unknown>>;
  }> = [];

  api.get = ((_: string, config?: AxiosRequestConfig) => {
    const pending = deferred<AxiosResponse<unknown>>();
    requests.push({ signal: config?.signal as AbortSignal | undefined, pending });
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockEventStore.getState().clear();
    const owner = new AbortController();
    const ownerLoad = useStockEventStore.getState().load(200, true, null, owner.signal);
    assert.equal(requests.length, 1);

    const waitingLoad = useStockEventStore.getState().load(200, true, null);
    owner.abort();
    assert.equal(requests[0].signal?.aborted, true);

    requests[0].pending.resolve(response([stockEvent('stale-owner')]));
    await ownerLoad;
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.equal(requests.length, 2);
    assert.equal(requests[1].signal?.aborted, false);
    requests[1].pending.resolve(response([stockEvent('fresh')]));
    await waitingLoad;

    assert.deepEqual(
      useStockEventStore.getState().events.map(event => event.id),
      ['fresh']
    );
    assert.equal(useStockEventStore.getState().initialized, true);
    assert.equal(useStockEventStore.getState().error, null);
  } finally {
    useStockEventStore.getState().clear();
    api.get = originalGet;
  }
});

test('stock-event read errors use normalized messages rather than backend response bodies', async () => {
  const originalGet = api.get;
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const failedResponse = {
    data: { message: 'private database connection string' },
    status: 503,
    statusText: 'Service Unavailable',
    headers: new AxiosHeaders(),
    config,
  };
  const error = new AxiosError(
    'Request failed with status code 503',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    failedResponse
  );

  api.get = (() => Promise.reject(error)) as typeof api.get;

  try {
    useStockEventStore.getState().clear();
    await useStockEventStore.getState().load(200, true, null);

    const state = useStockEventStore.getState();
    assert.equal(state.loading, false);
    assert.equal(state.initialized, true);
    assert.equal(state.error, 'The service is temporarily unavailable. Please try again.');
    assert.equal(state.error?.includes('private database connection string'), false);
  } finally {
    useStockEventStore.getState().clear();
    api.get = originalGet;
  }
});
