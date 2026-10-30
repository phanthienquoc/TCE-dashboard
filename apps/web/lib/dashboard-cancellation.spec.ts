import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { api, dashboardApi } from './api';
import { useDashboardStore } from './store';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;
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
    reject: reason => {
      if (!rejectPromise) throw new Error('Deferred promise has not initialized its rejecter');
      rejectPromise(reason);
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

test('dashboard read helpers forward optional AbortSignals to the Axios request', async () => {
  const previousAdapter = api.defaults.adapter;
  const requests: InternalAxiosRequestConfig[] = [];

  api.defaults.adapter = async config => {
    requests.push(config);
    return {
      data: { ok: true, data: [] },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    };
  };

  try {
    const controller = new AbortController();

    await dashboardApi.all('WATCHING', controller.signal);
    await dashboardApi.marketPrices(['DPM'], controller.signal);
    await dashboardApi.priceHistory('DPM', 30, controller.signal);
    await dashboardApi.all();

    assert.equal(requests.length, 4);
    assert.equal(requests[0].signal, controller.signal);
    assert.equal(requests[1].signal, controller.signal);
    assert.equal(requests[2].signal, controller.signal);
    assert.equal(requests[3].signal, undefined);
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});

test('a superseded dashboard load cannot overwrite newer data or clear its loading state', async () => {
  const originalAll = dashboardApi.all;
  const originalMarketPrices = dashboardApi.marketPrices;
  const requests: Array<{
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<unknown>>;
  }> = [];

  dashboardApi.all = ((_status?: string, signal?: AbortSignal) => {
    const pending = deferred<AxiosResponse<unknown>>();
    requests.push({ signal, pending });
    return pending.promise;
  }) as typeof dashboardApi.all;
  dashboardApi.marketPrices = (async () =>
    response({ ok: false })) as typeof dashboardApi.marketPrices;

  try {
    const store = useDashboardStore.getState();
    const firstLoad = store.load();
    const secondLoad = useDashboardStore.getState().load();

    assert.equal(requests.length, 2);
    assert.equal(requests[0].signal?.aborted, true);
    assert.equal(useDashboardStore.getState().loading, true);

    requests[0].pending.resolve(
      response({ id: 'old', positions: [], currentPositions: [], pools: [] })
    );
    await firstLoad;

    assert.equal(useDashboardStore.getState().data, null);
    assert.equal(
      useDashboardStore.getState().loading,
      true,
      'an obsolete request must not clear the current request loading state'
    );

    requests[1].pending.resolve(
      response({ id: 'new', positions: [], currentPositions: [], pools: [] })
    );
    await secondLoad;

    assert.equal(useDashboardStore.getState().data?.id, 'new');
    assert.equal(useDashboardStore.getState().loading, false);
  } finally {
    useDashboardStore.getState().clear();
    dashboardApi.all = originalAll;
    dashboardApi.marketPrices = originalMarketPrices;
  }
});

test('a newer market-price sync aborts the older sync and rejects its late result', async () => {
  const originalMarketPrices = dashboardApi.marketPrices;
  const requests: Array<{
    signal?: AbortSignal;
    pending: Deferred<AxiosResponse<unknown>>;
  }> = [];

  dashboardApi.marketPrices = ((_symbols: string[], signal?: AbortSignal) => {
    const pending = deferred<AxiosResponse<unknown>>();
    requests.push({ signal, pending });
    return pending.promise;
  }) as typeof dashboardApi.marketPrices;

  try {
    useDashboardStore.setState({
      data: { positions: [{ symbol: 'DPM' }], currentPositions: [], pools: [] },
      marketPrices: {},
      loading: false,
      error: null,
    });

    const firstSync = useDashboardStore.getState().syncMarketPrices();
    const secondSync = useDashboardStore.getState().syncMarketPrices();

    assert.equal(requests.length, 2);
    assert.equal(requests[0].signal?.aborted, true);

    requests[1].pending.resolve(response({ data: [{ symbol: 'DPM', price: 42.5 }] }));
    await secondSync;

    requests[0].pending.resolve(response({ data: [{ symbol: 'DPM', price: 41.0 }] }));
    await firstSync;

    assert.equal(useDashboardStore.getState().marketPrices.DPM?.price, 42.5);
    assert.equal(useDashboardStore.getState().data?.positions[0].marketPrice, 42.5);
  } finally {
    useDashboardStore.getState().clear();
    dashboardApi.marketPrices = originalMarketPrices;
  }
});

test('clear aborts an in-flight dashboard load and prevents its late response from repopulating state', async () => {
  const originalAll = dashboardApi.all;
  const pending = deferred<AxiosResponse<unknown>>();
  let requestSignal: AbortSignal | undefined;

  dashboardApi.all = ((_status?: string, signal?: AbortSignal) => {
    requestSignal = signal;
    return pending.promise;
  }) as typeof dashboardApi.all;

  try {
    const load = useDashboardStore.getState().load();
    useDashboardStore.getState().clear();

    assert.equal(requestSignal?.aborted, true);

    pending.resolve(response({ id: 'late', positions: [], currentPositions: [], pools: [] }));
    await load;

    assert.equal(useDashboardStore.getState().data, null);
    assert.equal(useDashboardStore.getState().loading, false);
    assert.equal(useDashboardStore.getState().error, null);
  } finally {
    useDashboardStore.getState().clear();
    dashboardApi.all = originalAll;
  }
});

test('intentional Axios cancellation does not become a dashboard error', async () => {
  const originalAll = dashboardApi.all;

  dashboardApi.all = (async () => {
    throw new axios.CanceledError();
  }) as typeof dashboardApi.all;

  try {
    await useDashboardStore.getState().load();

    assert.equal(useDashboardStore.getState().error, null);
    assert.equal(useDashboardStore.getState().loading, false);
  } finally {
    useDashboardStore.getState().clear();
    dashboardApi.all = originalAll;
  }
});
