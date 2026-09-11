import { GeminiConnectionService } from './gemini-connection.service';

describe('GeminiConnectionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs the generateContent request and accepts a valid response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'AI learns patterns from data.' }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await new GeminiConnectionService().testConnection(
      'secret-key',
      'gemini-2.5-flash'
    );

    expect(result).toEqual({
      ok: true,
      model: 'gemini-2.5-flash',
      message: 'Gemini connection successful.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=secret-key',
      expect.objectContaining({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Explain how AI works in a few words' }] }],
          generationConfig: { maxOutputTokens: 32, temperature: 0 },
        }),
      })
    );
  });

  it('strips a models/ prefix before building the provider URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await new GeminiConnectionService().testConnection('secret-key', 'models/gemini-2.5-flash');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=secret-key'
    );
  });

  it('maps auth, billing, quota, model and malformed-request failures', async () => {
    for (const [status, providerMessage, expected] of [
      [400, 'API key not valid', 'Gemini request rejected. Check the API key and request configuration.'],
      [401, '', 'Gemini authentication failed. Check the API key.'],
      [403, '', 'Gemini access denied. Check API access and billing/quota settings.'],
      [404, '', 'Gemini model was not found or is unavailable for this API key.'],
      [429, '', 'Gemini quota or rate limit reached.'],
    ] as const) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: { message: providerMessage } }),
      }) as typeof fetch;

      await expect(
        new GeminiConnectionService().testConnection('secret-key', 'gemini-2.5-flash')
      ).rejects.toThrow(expected);
    }
  });
});
