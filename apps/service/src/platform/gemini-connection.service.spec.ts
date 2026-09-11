import { GeminiConnectionService } from './gemini-connection.service';

describe('GeminiConnectionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs the fixed generateContent request and accepts a valid response', async () => {
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
      'Explain how AI works in a few words'
    );

    expect(result).toEqual({
      ok: true,
      model: 'gemini-flash-latest',
      message: 'Gemini connection successful.',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-goog-api-key': 'secret-key',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Explain how AI works in a few words' }],
            },
          ],
        }),
      })
    );
  });

  it('uses the default test text when none is provided', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await new GeminiConnectionService().testConnection('secret-key');

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      contents: [
        {
          parts: [{ text: 'Explain how AI works in a few words' }],
        },
      ],
    });
  });

  it('maps auth, billing, quota, model and malformed-request failures', async () => {
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
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: { message: providerMessage } }),
      }) as typeof fetch;

      await expect(
        new GeminiConnectionService().testConnection('secret-key')
      ).rejects.toThrow(expected);
    }
  });
});
