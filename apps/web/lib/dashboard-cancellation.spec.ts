import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { api, dashboardApi, platformApi } from './api';
import { useDashboardStore } from './store';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
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

test('dashboard and TCE prefetch reads forward optional AbortSignals to Axios', async () => {
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
    await dashboardApi.engines(controller.signal);
    await dashboardApi.engineConfig(controller.signal);
    await platformApi.credentials(controller.signal);
    await platformApi.telegramBots(controller.signal);
    await platformApi.telegramDebugAssignments(controller.signal);

    assert.equal(requests.length, 9);
    assert.equal(requests[0].signal, controller.signal);
    assert.equal(requests[1].signal, controller.signal);
    assert.equal(requests[2].signal, controller.signal);
    assert.equal(requests[3].signal, undefined);
    for (const request of requests.slice(4)) {
      assert.equal(request.signal, controller.signal);
    }
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

test('clear aborts dashboard and market-price reads and ignores their late responses', async () => {
  const originalAll = dashboardApi.all;
  const originalMarketPrices = dashboardApi.marketPrices;
  const dashboardPending = deferred<AxiosResponse<unknown>>();
  const pricesPending = deferred<AxiosResponse<unknown>>();
  let dashboardSignal: AbortSignal | undefined;
  let pricesSignal: AbortSignal | undefined;

  dashboardApi.all = ((_status?: string, signal?: AbortSignal) => {
    dashboardSignal = signal;
    return dashboardPending.promise;
  }) as typeof dashboardApi.all;
  dashboardApi.marketPrices = ((_symbols: string[], signal?: AbortSignal) => {
    pricesSignal = signal;
    return pricesPending.promise;
  }) as typeof dashboardApi.marketPrices;

  try {
    const load = useDashboardStore.getState().load();
    dashboardPending.resolve(
      response({ id: 'late', positions: [{ symbol: 'DPM' }], currentPositions: [], pools: [] })
    );
    await Promise.resolve();

    assert.ok(pricesSignal, 'the dashboard snapshot should start a market-price read');
    useDashboardStore.getState().clear();

    assert.equal(dashboardSignal?.aborted, true);
    assert.equal(pricesSignal?.aborted, true);

    pricesPending.resolve(response({ data: [{ symbol: 'DPM', price: 42.5 }] }));
    await load;

    assert.equal(useDashboardStore.getState().data, null);
    assert.deepEqual(useDashboardStore.getState().marketPrices, {});
    assert.equal(useDashboardStore.getState().loading, false);
    assert.equal(useDashboardStore.getState().error, null);
  } finally {
    useDashboardStore.getState().clear();
    dashboardApi.all = originalAll;
    dashboardApi.marketPrices = originalMarketPrices;
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

test('market-price sync logs normalized failures without leaking Axios config or credentials', async () => {
  const originalMarketPrices = dashboardApi.marketPrices;
  const originalConsoleError = console.error;
  const logCalls: unknown[][] = [];
  const requestConfig = {
    url: '/dashboard/market-prices',
    method: 'get',
    headers: new AxiosHeaders({
      Authorization: 'Bearer should-not-leak',
      'x-api-key': 'should-not-leak-api-key',
    }),
  } as InternalAxiosRequestConfig;
  const error = new axios.AxiosError(
    'private transport detail should not be logged',
    'ERR_BAD_RESPONSE',
    requestConfig,
    undefined,
    {
      data: { secret: 'private response body should not be logged' },
      status: 500,
      statusText: 'Internal Server Error',
      headers: new AxiosHeaders(),
      config: requestConfig,
    }
  );

  dashboardApi.marketPrices = (async () => {
    throw error;
  }) as typeof dashboardApi.marketPrices;
  console.error = (...args) => {
    logCalls.push(args);
  };

  try {
    useDashboardStore.setState({
      data: { positions: [{ symbol: 'DPM' }], currentPositions: [], pools: [] },
      marketPrices: {},
      loading: false,
      error: null,
    });

    await useDashboardStore.getState().syncMarketPrices();

    assert.deepEqual(logCalls, [
      [
        '[FE_MARKET_PRICE_SYNC]',
        {
          kind: 'http',
          status: 500,
          message: 'The service is temporarily unavailable. Please try again.',
        },
      ],
    ]);

    const serializedLogs = JSON.stringify(logCalls);
    assert.equal(serializedLogs.includes('should-not-leak'), false);
    assert.equal(serializedLogs.includes('should-not-leak-api-key'), false);
    assert.equal(serializedLogs.includes('private transport detail'), false);
    assert.equal(serializedLogs.includes('private response body'), false);
    assert.equal(serializedLogs.includes('Authorization'), false);
    assert.equal(serializedLogs.includes('x-api-key'), false);
    assert.equal(serializedLogs.includes('Internal Server Error'), false);
  } finally {
    console.error = originalConsoleError;
    useDashboardStore.getState().clear();
    dashboardApi.marketPrices = originalMarketPrices;
  }
});
