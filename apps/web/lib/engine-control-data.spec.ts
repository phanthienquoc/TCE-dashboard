import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { dashboardApi } from './api';
import { loadEngineControlData, normalizeEngineControlReadFailure } from './engine-control-data';

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

test('normalizes Engine Control read failures without exposing response bodies or exception messages', () => {
  const config = {
    headers: new AxiosHeaders({ Authorization: 'Bearer engine-control-test-secret' }),
  } as InternalAxiosRequestConfig;
  const failedResponse: AxiosResponse<unknown> = {
    data: { message: 'private engine database details' },
    status: 500,
    statusText: 'Internal Server Error',
    headers: new AxiosHeaders(),
    config,
  };
  const failure = normalizeEngineControlReadFailure(
    new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config, undefined, failedResponse)
  );

  assert.equal(failure.kind, 'http');
  assert.equal(failure.status, 500);
  assert.equal(failure.message, 'The service is temporarily unavailable. Please try again.');
  assert.equal(failure.retryable, true);
  assert.equal(JSON.stringify(failure).includes('engine-control-test-secret'), false);
  assert.equal(JSON.stringify(failure).includes('private engine database details'), false);
  assert.equal(JSON.stringify(failure).includes('ERR_BAD_RESPONSE'), false);

  const fallback = normalizeEngineControlReadFailure(new Error('private internal exception'));
  assert.equal(fallback.kind, 'unknown');
  assert.equal(fallback.message, 'Unable to load engine status and configuration.');
  assert.equal(JSON.stringify(fallback).includes('private internal exception'), false);
});

test('Engine Control reads share the caller AbortSignal', async () => {
  const originalEngines = dashboardApi.engines;
  const originalConfig = dashboardApi.engineConfig;
  const signals: Array<AbortSignal | undefined> = [];
  const states = [{ engineId: 'binance-xau', status: 'ACTIVE' }];
  const configs = [
    {
      engineId: 'binance-xau',
      enabled: true,
      config: { quantity: 0.01 },
      updatedAt: '2026-10-30T00:00:00Z',
    },
  ];

  dashboardApi.engines = ((signal?: AbortSignal) => {
    signals.push(signal);
    return Promise.resolve(response(states));
  }) as typeof dashboardApi.engines;
  dashboardApi.engineConfig = ((signal?: AbortSignal) => {
    signals.push(signal);
    return Promise.resolve(response(configs));
  }) as typeof dashboardApi.engineConfig;

  try {
    const controller = new AbortController();
    const result = await loadEngineControlData(controller.signal);

    assert.deepEqual(result, { states, configs });
    assert.equal(signals.length, 2);
    assert.ok(signals.every(signal => signal === controller.signal));
  } finally {
    dashboardApi.engines = originalEngines;
    dashboardApi.engineConfig = originalConfig;
  }
});

test('aborting the shared signal cancels both pending Engine Control reads', async () => {
  const originalEngines = dashboardApi.engines;
  const originalConfig = dashboardApi.engineConfig;
  const signals: Array<AbortSignal | undefined> = [];
  const pendingRead = (signal?: AbortSignal) =>
    new Promise<AxiosResponse<unknown>>((_resolve, reject) => {
      signals.push(signal);
      if (signal?.aborted) {
        reject(new Error('cancelled'));
        return;
      }
      signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });

  dashboardApi.engines = ((signal?: AbortSignal) =>
    pendingRead(signal)) as typeof dashboardApi.engines;
  dashboardApi.engineConfig = ((signal?: AbortSignal) =>
    pendingRead(signal)) as typeof dashboardApi.engineConfig;

  try {
    const controller = new AbortController();
    const pending = loadEngineControlData(controller.signal);
    controller.abort();

    await assert.rejects(pending, /cancelled/);
    assert.equal(signals.length, 2);
    assert.ok(signals.every(signal => signal?.aborted));
  } finally {
    dashboardApi.engines = originalEngines;
    dashboardApi.engineConfig = originalConfig;
  }
});

test('Engine Control read helper defaults missing collections to empty arrays', async () => {
  const originalEngines = dashboardApi.engines;
  const originalConfig = dashboardApi.engineConfig;

  dashboardApi.engines = (async () => response(null)) as typeof dashboardApi.engines;
  dashboardApi.engineConfig = (async () => response(undefined)) as typeof dashboardApi.engineConfig;

  try {
    const result = await loadEngineControlData(new AbortController().signal);
    assert.deepEqual(result, { states: [], configs: [] });
  } finally {
    dashboardApi.engines = originalEngines;
    dashboardApi.engineConfig = originalConfig;
  }
});
