import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { dashboardApi, platformApi } from './api';
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

test('clear aborts TCE prefetch reads and prevents late account data from repopulating the store', async () => {
  const original = {
    dashboard: dashboardApi.all,
    engines: dashboardApi.engines,
    engineConfig: dashboardApi.engineConfig,
    credentials: platformApi.credentials,
    telegramBots: platformApi.telegramBots,
    telegramAssignments: platformApi.telegramDebugAssignments,
  };
  const pending = Object.fromEntries(
    endpointNames.map(name => [
      name,
      [deferred<AxiosResponse<unknown>>(), deferred<AxiosResponse<unknown>>()],
    ])
  ) as Record<EndpointName, Deferred<AxiosResponse<unknown>>[]>;
  const signals = Object.fromEntries(
    endpointNames.map(name => [name, [] as AbortSignal[]])
  ) as Record<EndpointName, AbortSignal[]>;

  const takePending = (name: EndpointName, signal?: AbortSignal) => {
    if (!signal) throw new Error(`Expected an AbortSignal for ${name}`);
    const index = signals[name].length;
    signals[name].push(signal);
    const request = pending[name][index];
    if (!request) throw new Error(`Unexpected ${name} request #${index + 1}`);
    return request.promise;
  };

  dashboardApi.all = ((_status?: string, signal?: AbortSignal) =>
    takePending('dashboard', signal)) as typeof dashboardApi.all;
  dashboardApi.engines = ((signal?: AbortSignal) =>
    takePending('engines', signal)) as typeof dashboardApi.engines;
  dashboardApi.engineConfig = ((signal?: AbortSignal) =>
    takePending('engineConfig', signal)) as typeof dashboardApi.engineConfig;
  platformApi.credentials = ((signal?: AbortSignal) =>
    takePending('credentials', signal)) as typeof platformApi.credentials;
  platformApi.telegramBots = ((signal?: AbortSignal) =>
    takePending('telegramBots', signal)) as typeof platformApi.telegramBots;
  platformApi.telegramDebugAssignments = ((signal?: AbortSignal) =>
    takePending('telegramAssignments', signal)) as typeof platformApi.telegramDebugAssignments;

  const resolveBatch = (index: number, marker: string) => {
    pending.dashboard[index].resolve(response({ marker, positions: [] }));
    pending.engines[index].resolve(response([{ marker }]));
    pending.engineConfig[index].resolve(response({ marker }));
    pending.credentials[index].resolve(response({ marker }));
    pending.telegramBots[index].resolve(response({ bots: [{ marker }] }));
    pending.telegramAssignments[index].resolve(response({ assignments: [{ marker }] }));
  };

  try {
    useTCEDataStore.getState().clear();
    const oldPrefetch = useTCEDataStore.getState().prefetch();

    assert.equal(signals.dashboard.length, 1);
    assert.ok(endpointNames.every(name => signals[name][0] === signals.dashboard[0]));

    useTCEDataStore.getState().clear();
    assert.ok(endpointNames.every(name => signals[name][0].aborted));

    const newPrefetch = useTCEDataStore.getState().prefetch();
    assert.ok(endpointNames.every(name => signals[name].length === 2));
    assert.ok(endpointNames.every(name => !signals[name][1].aborted));
    assert.notEqual(signals.dashboard[0], signals.dashboard[1]);

    resolveBatch(1, 'new-account');
    await newPrefetch;

    assert.equal(useTCEDataStore.getState().credentials?.marker, 'new-account');
    assert.equal(useTCEDataStore.getState().initialized, true);

    resolveBatch(0, 'old-account');
    await oldPrefetch;

    assert.equal(useTCEDataStore.getState().credentials?.marker, 'new-account');
    assert.equal(useTCEDataStore.getState().dashboard?.marker, 'new-account');
    assert.equal(useTCEDataStore.getState().engines?.[0]?.marker, 'new-account');
    assert.equal(useTCEDataStore.getState().loading, false);
  } finally {
    useTCEDataStore.getState().clear();
    dashboardApi.all = original.dashboard;
    dashboardApi.engines = original.engines;
    dashboardApi.engineConfig = original.engineConfig;
    platformApi.credentials = original.credentials;
    platformApi.telegramBots = original.telegramBots;
    platformApi.telegramDebugAssignments = original.telegramAssignments;
  }
});
