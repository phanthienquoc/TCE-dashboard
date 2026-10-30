import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { dashboardApi } from './api';
import { loadEngineControlData } from './engine-control-data';

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

test('Engine Control reads forward one effect-owned AbortSignal to both existing GETs', async () => {
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

test('Engine Control read helper normalizes empty response collections without changing the API contract', async () => {
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
