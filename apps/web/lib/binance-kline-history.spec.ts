import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchBinanceKlineHistory } from './binance-kline-history';

test('Binance kline history forwards cancellation and bounds the public request', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify([['1', '2', '3', '4', '5']]), { status: 200 });
  }) as typeof fetch;

  try {
    const rows = await fetchBinanceKlineHistory('btcusdt', '1m', 2000, controller.signal);
    const url = new URL(requestUrl);

    assert.equal(url.origin, 'https://api.binance.com');
    assert.equal(url.pathname, '/api/v3/klines');
    assert.equal(url.searchParams.get('symbol'), 'BTCUSDT');
    assert.equal(url.searchParams.get('interval'), '1m');
    assert.equal(url.searchParams.get('limit'), '1000');
    assert.equal(requestInit?.cache, 'no-store');
    assert.equal(requestInit?.signal, controller.signal);
    assert.deepEqual(rows, [['1', '2', '3', '4', '5']]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('aborting the caller signal aborts the pending Binance history request', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestSignal: AbortSignal | null | undefined;

  globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
    requestSignal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true }
      );
    });
  }) as typeof fetch;

  try {
    const pending = fetchBinanceKlineHistory('BTCUSDT', '1m', 240, controller.signal);
    controller.abort();

    assert.equal(requestSignal?.aborted, true);
    await assert.rejects(pending, { name: 'AbortError' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Binance kline history reports non-success HTTP status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('', { status: 429, statusText: 'Too Many Requests' })) as typeof fetch;

  try {
    await assert.rejects(
      fetchBinanceKlineHistory('BTCUSDT', '1m', 240, new AbortController().signal),
      /Binance HTTP 429/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
