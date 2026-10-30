import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { dashboardApi } from './api';
import { useEngineRuntimeStore, type EngineRuntimeNode } from './engine-runtime-store';

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

function engineNode(engineId: string): EngineRuntimeNode {
  return {
    engineId,
    configured: true,
    configuredEnabled: true,
    persistedStatus: 'ACTIVE',
    status: 'ACTIVE',
    dependencies: [],
    blockedBy: [],
    updatedAt: '2026-10-30T00:00:00.000Z',
    error: null,
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

test('clear aborts a pending runtime read and fences its late result from the next account', async () => {
  const originalEngineRuntime = dashboardApi.engineRuntime;
  const oldRequest = deferred<AxiosResponse<{ engines: EngineRuntimeNode[] }>>();
  const newRequest = deferred<AxiosResponse<{ engines: EngineRuntimeNode[] }>>();
  const signals: AbortSignal[] = [];
  let calls = 0;

  dashboardApi.engineRuntime = ((signal?: AbortSignal) => {
    if (signal) signals.push(signal);
    calls += 1;
    return calls === 1 ? oldRequest.promise : newRequest.promise;
  }) as typeof dashboardApi.engineRuntime;

  try {
    useEngineRuntimeStore.getState().clear();
    const oldRefresh = useEngineRuntimeStore.getState().refresh();
    await Promise.resolve();

    assert.equal(calls, 1);
    assert.ok(signals[0]);

    useEngineRuntimeStore.getState().clear();

    assert.equal(signals[0].aborted, true);
    assert.equal(useEngineRuntimeStore.getState().loading, false);
    assert.deepEqual(useEngineRuntimeStore.getState().engines, []);

    const newRefresh = useEngineRuntimeStore.getState().refresh();
    await Promise.resolve();
    assert.equal(calls, 2);

    oldRequest.resolve(response({ engines: [engineNode('old-account-engine')] }));
    await oldRefresh;

    assert.deepEqual(useEngineRuntimeStore.getState().engines, []);
    assert.equal(useEngineRuntimeStore.getState().loading, true);

    newRequest.resolve(response({ engines: [engineNode('new-account-engine')] }));
    await newRefresh;

    assert.deepEqual(
      useEngineRuntimeStore.getState().engines.map(engine => engine.engineId),
      ['new-account-engine']
    );
    assert.equal(useEngineRuntimeStore.getState().loading, false);
  } finally {
    useEngineRuntimeStore.getState().clear();
    dashboardApi.engineRuntime = originalEngineRuntime;
  }
});

test('runtime refresh normalizes HTTP errors without exposing backend details', async () => {
  const originalEngineRuntime = dashboardApi.engineRuntime;
  dashboardApi.engineRuntime = (async () => {
    throw httpError(403, 'private database schema and connection detail');
  }) as typeof dashboardApi.engineRuntime;

  try {
    useEngineRuntimeStore.getState().clear();
    await useEngineRuntimeStore.getState().refresh();

    const state = useEngineRuntimeStore.getState();
    assert.equal(state.error, 'You do not have permission to perform this action.');
    assert.equal(state.error?.includes('private database'), false);
    assert.equal(state.loading, false);
  } finally {
    useEngineRuntimeStore.getState().clear();
    dashboardApi.engineRuntime = originalEngineRuntime;
  }
});

test('runtime refresh uses the safe fallback for non-Axios errors', async () => {
  const originalEngineRuntime = dashboardApi.engineRuntime;
  dashboardApi.engineRuntime = (async () => {
    throw new Error('raw internal connection detail');
  }) as typeof dashboardApi.engineRuntime;

  try {
    useEngineRuntimeStore.getState().clear();
    await useEngineRuntimeStore.getState().refresh();

    const state = useEngineRuntimeStore.getState();
    assert.equal(state.error, 'Unable to load engine runtime');
    assert.equal(state.error?.includes('raw internal'), false);
    assert.equal(state.loading, false);
  } finally {
    useEngineRuntimeStore.getState().clear();
    dashboardApi.engineRuntime = originalEngineRuntime;
  }
});
