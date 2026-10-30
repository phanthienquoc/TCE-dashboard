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
  useStockDividendPoolStore,
  type StockDividendPoolItem,
} from './stock-dividend-pool-store';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((error: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: value => {
      if (!resolvePromise) throw new Error('Deferred promise has not initialized its resolver');
      resolvePromise(value);
    },
    reject: error => {
      if (!rejectPromise) throw new Error('Deferred promise has not initialized its rejecter');
      rejectPromise(error);
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

function poolItem(id: string): StockDividendPoolItem {
  return {
    id,
    rank: 1,
    ticker: id.toUpperCase(),
    exDividendDate: '2026-11-15',
    exDividendTimestamp: '2026-11-15T00:00:00.000Z',
    paymentDate: null,
    eventContent: 'Cash dividend',
    dividendRate: '10%',
    dividendValue: 100,
    price: 25,
    dividendYieldPct: 4,
    score: 8,
    daysToExDate: 16,
  };
}

test('a newer month request aborts the previous read and ignores its late response', async () => {
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
    useStockDividendPoolStore.setState({ items: [], loading: false, error: null });
    const october = useStockDividendPoolStore.getState().load('2026-10');
    const november = useStockDividendPoolStore.getState().load('2026-11');

    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /month=2026-10/);
    assert.match(requests[1].url, /month=2026-11/);
    assert.equal(requests[0].signal?.aborted, true);
    assert.equal(requests[1].signal?.aborted, false);
    assert.equal(useStockDividendPoolStore.getState().loading, true);

    requests[1].pending.resolve(response([poolItem('november')]));
    await november;
    assert.deepEqual(useStockDividendPoolStore.getState().items, [poolItem('november')]);
    assert.equal(useStockDividendPoolStore.getState().loading, false);

    // Simulate a transport/mock that resolves despite cancellation.
    requests[0].pending.resolve(response([poolItem('october')]));
    await october;
    assert.deepEqual(useStockDividendPoolStore.getState().items, [poolItem('november')]);
    assert.equal(useStockDividendPoolStore.getState().loading, false);
  } finally {
    activeReset();
    api.get = originalGet;
  }
});

test('an aborted worker signal cancels the pool read without exposing an error or replacing data', async () => {
  const originalGet = api.get;
  const pending = deferred<AxiosResponse<unknown>>();
  let requestSignal: AbortSignal | undefined;
  const existing = [poolItem('existing')];

  api.get = ((_: string, config?: AxiosRequestConfig) => {
    requestSignal = config?.signal as AbortSignal | undefined;
    return pending.promise;
  }) as typeof api.get;

  try {
    useStockDividendPoolStore.setState({ items: existing, loading: false, error: null });
    const worker = new AbortController();
    const load = useStockDividendPoolStore.getState().load('2026-11', worker.signal);

    assert.equal(requestSignal?.aborted, false);
    worker.abort();
    assert.equal(requestSignal?.aborted, true);

    pending.resolve(response([poolItem('late')]));
    await load;
    assert.deepEqual(useStockDividendPoolStore.getState().items, existing);
    assert.equal(useStockDividendPoolStore.getState().loading, false);
    assert.equal(useStockDividendPoolStore.getState().error, null);
  } finally {
    activeReset();
    api.get = originalGet;
  }
});

test('pool read errors use normalized messages rather than backend response bodies', async () => {
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
    useStockDividendPoolStore.setState({ items: [], loading: false, error: null });
    await useStockDividendPoolStore.getState().load('2026-11');

    const state = useStockDividendPoolStore.getState();
    assert.equal(state.loading, false);
    assert.equal(state.error, 'The service is temporarily unavailable. Please try again.');
    assert.equal(state.error?.includes('private database connection string'), false);
  } finally {
    activeReset();
    api.get = originalGet;
  }
});

function activeReset() {
  // Resolve the store's visible state between tests; each test also settles its request.
  useStockDividendPoolStore.setState({ items: [], loading: false, error: null });
}
