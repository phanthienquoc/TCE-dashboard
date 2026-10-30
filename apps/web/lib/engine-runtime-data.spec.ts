import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { api } from './api';
import { loadEngineRuntime } from './engine-runtime-data';

function response<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  };
}

test('engine runtime reads forward AbortSignal and return the engine collection', async () => {
  const previousAdapter = api.defaults.adapter;
  const requests: InternalAxiosRequestConfig[] = [];
  const engine = {
    engineId: 'tce-decision',
    configuredEnabled: true,
    status: 'ACTIVE' as const,
    dependencies: [],
  };

  api.defaults.adapter = async config => {
    requests.push(config);
    return response(config, { accountId: 'account-1', engines: [engine] });
  };

  const controller = new AbortController();
  try {
    assert.deepEqual(await loadEngineRuntime(controller.signal), [engine]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/dashboard/engine-runtime');
    assert.equal(requests[0].signal, controller.signal);
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});

test('engine runtime read normalizes a malformed collection to an empty list', async () => {
  const previousAdapter = api.defaults.adapter;

  api.defaults.adapter = async config =>
    response(config, { accountId: 'account-1', engines: null });

  try {
    assert.deepEqual(await loadEngineRuntime(new AbortController().signal), []);
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});

test('engine runtime read rejects when its AbortSignal is cancelled', async () => {
  const previousAdapter = api.defaults.adapter;
  let signalObserved: AbortSignal | undefined;
  let resolveStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => {
    resolveStarted = resolve;
  });

  api.defaults.adapter = config =>
    new Promise<AxiosResponse>((_resolve, reject) => {
      const signal = config.signal as AbortSignal | undefined;
      signalObserved = signal;
      resolveStarted?.();
      const rejectCancelled = () => reject(new axios.CanceledError('Request cancelled', config));
      if (signal?.aborted) {
        rejectCancelled();
        return;
      }
      signal?.addEventListener('abort', rejectCancelled, { once: true });
    });

  const controller = new AbortController();
  try {
    const pending = loadEngineRuntime(controller.signal);
    await started;
    controller.abort();
    await assert.rejects(pending, error => axios.isCancel(error));
    assert.equal(signalObserved, controller.signal);
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});
