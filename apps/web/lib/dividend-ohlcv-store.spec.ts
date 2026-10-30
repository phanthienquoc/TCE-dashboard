import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosHeaders,
  CanceledError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { dashboardApi } from './api';
import { useDividendOhlcvStore } from './dividend-ohlcv-store';

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

test('dividend OHLCV reads forward the component lifecycle signal and normalize rows', async () => {
  const originalPriceHistory = dashboardApi.priceHistory;
  let receivedSignal: AbortSignal | undefined;
  dashboardApi.priceHistory = (async (symbol, days, signal) => {
    assert.equal(symbol, 'DPM');
    assert.equal(days, 365);
    receivedSignal = signal;
    return response({
      data: [
        {
          trading_date: '2026-10-30',
          open: '10',
          high: '12',
          low: '9',
          close: '11',
          volume: '1000',
        },
      ],
    });
  }) as typeof dashboardApi.priceHistory;

  try {
    useDividendOhlcvStore.getState().clear();
    const controller = new AbortController();
    await useDividendOhlcvStore.getState().load(' dpm ', 365, controller.signal);

    assert.ok(receivedSignal);
    assert.notEqual(receivedSignal, controller.signal);
    assert.equal(receivedSignal?.aborted, false);
    assert.deepEqual(useDividendOhlcvStore.getState().histories.DPM, [
      {
        tradingDate: '2026-10-30',
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 1000,
      },
    ]);
    assert.equal(useDividendOhlcvStore.getState().loading.DPM, false);
  } finally {
    useDividendOhlcvStore.getState().clear();
    dashboardApi.priceHistory = originalPriceHistory;
  }
});

test(
  'unmount cancellation aborts the history request without leaving loading or an error',
  async () => {
  const originalPriceHistory = dashboardApi.priceHistory;
  const pending = deferred<AxiosResponse<{ data: unknown[] }>>();
  let receivedSignal: AbortSignal | undefined;
  dashboardApi.priceHistory = ((_symbol, _days, signal) => {
    receivedSignal = signal;
    return pending.promise;
  }) as typeof dashboardApi.priceHistory;

  try {
    useDividendOhlcvStore.getState().clear();
    const controller = new AbortController();
    const load = useDividendOhlcvStore.getState().load('DPM', 365, controller.signal);

    assert.equal(useDividendOhlcvStore.getState().loading.DPM, true);
    controller.abort();

    assert.equal(receivedSignal?.aborted, true);
    assert.equal(useDividendOhlcvStore.getState().loading.DPM, false);
    pending.reject(new CanceledError('request canceled'));
    await load;

    assert.equal(useDividendOhlcvStore.getState().loading.DPM, false);
    assert.equal(useDividendOhlcvStore.getState().errors.DPM ?? null, null);
    assert.equal(useDividendOhlcvStore.getState().histories.DPM, undefined);
  } finally {
    useDividendOhlcvStore.getState().clear();
    dashboardApi.priceHistory = originalPriceHistory;
  }
});

test(
  'clear aborts an old history request and prevents its late response replacing a new read',
  async () => {
  const originalPriceHistory = dashboardApi.priceHistory;
  const requests: Array<{
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<{ data: unknown[] }>>;
  }> = [];
  dashboardApi.priceHistory = ((_symbol, _days, signal) => {
    const pending = deferred<AxiosResponse<{ data: unknown[] }>>();
    requests.push({ signal, pending });
    return pending.promise;
  }) as typeof dashboardApi.priceHistory;

  try {
    useDividendOhlcvStore.getState().clear();
    const firstLoad = useDividendOhlcvStore.getState().load('DPM');
    assert.equal(requests.length, 1);

    useDividendOhlcvStore.getState().clear();
    assert.equal(requests[0].signal?.aborted, true);
    assert.deepEqual(useDividendOhlcvStore.getState().histories, {});

    const secondLoad = useDividendOhlcvStore.getState().load('DPM');
    assert.equal(requests.length, 2);
    requests[0].pending.resolve(response({ data: [{ trading_date: 'old', close: 1 }] }));
    await firstLoad;

    assert.equal(useDividendOhlcvStore.getState().histories.DPM, undefined);
    assert.equal(useDividendOhlcvStore.getState().loading.DPM, true);

    requests[1].pending.resolve(response({ data: [{ trading_date: 'new', close: 2 }] }));
    await secondLoad;

    assert.equal(useDividendOhlcvStore.getState().histories.DPM?.[0].tradingDate, 'new');
    assert.equal(useDividendOhlcvStore.getState().histories.DPM?.[0].close, 2);
    assert.equal(useDividendOhlcvStore.getState().loading.DPM, false);
  } finally {
    useDividendOhlcvStore.getState().clear();
    dashboardApi.priceHistory = originalPriceHistory;
  }
});

test('dividend OHLCV errors use a safe fallback instead of raw exception details', async () => {
  const originalPriceHistory = dashboardApi.priceHistory;
  dashboardApi.priceHistory = (async () => {
    throw new Error('internal database connection detail');
  }) as typeof dashboardApi.priceHistory;

  try {
    useDividendOhlcvStore.getState().clear();
    await useDividendOhlcvStore.getState().load('DPM');

    assert.equal(useDividendOhlcvStore.getState().errors.DPM, 'Unable to load 1Y candle history');
    assert.equal(useDividendOhlcvStore.getState().loading.DPM, false);
  } finally {
    useDividendOhlcvStore.getState().clear();
    dashboardApi.priceHistory = originalPriceHistory;
  }
});
