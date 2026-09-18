import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiConnectionService } from './gemini-connection.service';

test('GeminiConnectionService constructs the fixed generateContent request and accepts a valid response', async () => {
  const originalFetch = global.fetch;
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  global.fetch = async (input, init) => {
    calls.push([input, init]);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'AI learns patterns from data.' }] } }],
      }),
    } as Response;
  };

  try {
    const result = await new GeminiConnectionService().testConnection(
      'secret-key',
      'Explain how AI works in a few words'
    );

    assert.deepEqual(result, {
      ok: true,
      model: 'gemini-flash-latest',
      message: 'Gemini connection successful.',
    });
    assert.equal(calls.length, 1);
    const [url, init] = calls[0];
    assert.equal(
      String(url),
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
    );
    assert.equal(init?.method, 'POST');
    assert.deepEqual(init?.headers, {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-goog-api-key': 'secret-key',
    });
    assert.deepEqual(JSON.parse(String(init?.body)), {
      contents: [{ parts: [{ text: 'Explain how AI works in a few words' }] }],
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('GeminiConnectionService uses the default test text when none is provided', async () => {
  const originalFetch = global.fetch;
  let body = '';
  global.fetch = async (_input, init) => {
    body = String(init?.body ?? '');
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    } as Response;
  };

  try {
    await new GeminiConnectionService().testConnection('secret-key');
    assert.deepEqual(JSON.parse(body), {
      contents: [{ parts: [{ text: 'Explain how AI works in a few words' }] }],
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('GeminiConnectionService maps auth, billing, quota, model and malformed-request failures', async () => {
  const originalFetch = global.fetch;
  try {
    for (const [status, providerMessage, expected] of [
      [
        400,
        'API key not valid',
        'Gemini request rejected. Check the API key and request configuration.',
      ],
      [401, '', 'Gemini authentication failed. Check the API key.'],
      [403, '', 'Gemini access denied. Check API access and billing/quota settings.'],
      [404, '', 'Gemini model was not found or is unavailable for this API key.'],
      [429, '', 'Gemini quota or rate limit reached.'],
    ] as const) {
      global.fetch = async () =>
        ({
          ok: false,
          status,
          json: async () => ({ error: { message: providerMessage } }),
        }) as Response;

      await assert.rejects(
        () => new GeminiConnectionService().testConnection('secret-key'),
        error => error instanceof Error && error.message === expected
      );
    }
  } finally {
    global.fetch = originalFetch;
  }
});
