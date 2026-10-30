import assert from 'node:assert/strict';
import test from 'node:test';
import axios, { AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { platformApi } from './api';
import { loadBinanceXauPosition, type BinanceXauPosition } from './binance-xau-position-data';

function response<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  };
}

test('XAU position read forwards environment and signal and selects an open position', async () => {
  const original = platformApi.binanceXauPositions;
  let receivedEnvironment: string | undefined;
  let receivedSignal: AbortSignal | undefined;
  const positions: BinanceXauPosition[] = [
    {
      symbol: 'XAUUSDT',
      positionAmt: 0,
      entryPrice: 0,
      markPrice: 0,
      unrealizedProfit: 0,
    },
    {
      symbol: 'XAUUSDT',
      positionAmt: -0.01,
      entryPrice: 3000,
      markPrice: 2990,
      unrealizedProfit: 0.1,
      positionSide: 'SHORT',
    },
  ];

  platformApi.binanceXauPositions = ((environment = 'production', signal?: AbortSignal) => {
    receivedEnvironment = environment;
    receivedSignal = signal;
    return Promise.resolve(response(positions));
  }) as typeof platformApi.binanceXauPositions;

  try {
    const controller = new AbortController();
    const position = await loadBinanceXauPosition('testnet', controller.signal);

    assert.equal(receivedEnvironment, 'testnet');
    assert.equal(receivedSignal, controller.signal);
    assert.deepEqual(position, positions[1]);
  } finally {
    platformApi.binanceXauPositions = original;
  }
});

test('XAU position read normalizes empty, zero-only, and non-array payloads to null', async () => {
  const original = platformApi.binanceXauPositions;
  let payload: unknown = [];

  platformApi.binanceXauPositions = (() =>
    Promise.resolve(response(payload))) as typeof platformApi.binanceXauPositions;

  try {
    const controller = new AbortController();
    assert.equal(await loadBinanceXauPosition('production', controller.signal), null);

    payload = [{ symbol: 'XAUUSDT', positionAmt: 0 }];
    assert.equal(await loadBinanceXauPosition('production', controller.signal), null);

    payload = { positions: [{ symbol: 'XAUUSDT', positionAmt: 0.01 }] };
    assert.equal(await loadBinanceXauPosition('production', controller.signal), null);
  } finally {
    platformApi.binanceXauPositions = original;
  }
});

test('XAU position read preserves intentional cancellation', async () => {
  const original = platformApi.binanceXauPositions;
  platformApi.binanceXauPositions = ((_environment = 'production', signal?: AbortSignal) =>
    new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new axios.CanceledError()), { once: true });
    })) as typeof platformApi.binanceXauPositions;

  try {
    const controller = new AbortController();
    const pending = loadBinanceXauPosition('production', controller.signal);
    controller.abort();

    await assert.rejects(pending, error => axios.isCancel(error));
  } finally {
    platformApi.binanceXauPositions = original;
  }
});
