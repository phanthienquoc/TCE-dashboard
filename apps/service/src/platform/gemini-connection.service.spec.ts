import { GeminiConnectionService } from './gemini-connection.service';

describe('GeminiConnectionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('constructs the demo generateContent request and accepts a valid response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'AI learns patterns from data.' }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await new GeminiConnectionService().testConnection('secret-key', 'gemini-2.5-flash');

    expect(result).toEqual({
      ok: true,
      model: 'gemini-2.5-flash',
      message: 'Gemini connection successful.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': 'secret-key',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Explain how AI works in a few words' }] }],
        }),
      })
    );
  });

  it('maps auth, billing, quota and model failures without exposing provider payloads', async () => {
    for (const [status, expected] of [
      [401, 'Gemini authentication failed. Check the API key.'],
      [403, 'Gemini access denied. Check API access and billing/quota settings.'],
      [404, 'Gemini model was not found or is unavailable for this API key.'],
      [429, 'Gemini quota or rate limit reached.'],
    ] as const) {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status }) as typeof fetch;
      await expect(
        new GeminiConnectionService().testConnection('secret-key', 'gemini-2.5-flash')
      ).rejects.toThrow(expected);
    }
  });
});
