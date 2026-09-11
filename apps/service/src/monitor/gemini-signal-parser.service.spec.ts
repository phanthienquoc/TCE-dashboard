import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiSignalParserService } from './gemini-signal-parser.service';

describe('GeminiSignalParserService', () => {
  const credentials = {
    get: vi.fn().mockResolvedValue({ apiKey: 'test-key', model: 'gemini-2.5-flash-lite' }),
  };
  let service: GeminiSignalParserService;

  beforeEach(() => {
    vi.restoreAllMocks();
    credentials.get.mockResolvedValue({ apiKey: 'test-key', model: 'gemini-2.5-flash-lite' });
    service = new GeminiSignalParserService(credentials as never);
  });

  it('parses canonical four-line output from Gemini', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(
      service.parse('user-1', 'production', 'XAUUSD buy entry 4582 tp 4588 sl 4567')
    ).resolves.toEqual({
      symbol: 'XAUUSD',
      side: 'BUY',
      entry: 4582,
      takeProfit: 4588,
      stopLoss: 4567,
    });
  });

  it('retries after invalid AI output and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'XAUUSD BUY ENTRY 4582' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      service.parse('user-1', 'production', 'Signal for XAUUSD: BUY 4582 / TP 4588 / SL 4567')
    ).resolves.toMatchObject({ symbol: 'XAUUSD', side: 'BUY', entry: 4582 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(secondBody.contents[0].parts[0].text).toContain('Previous parse failure:');
    expect(secondBody.contents[0].parts[0].text).toContain('XAUUSD BUY');
    expect(secondBody.contents[0].parts[0].text).toContain('ENTRY 4582');
    expect(secondBody.contents[0].parts[0].text).toContain('TP 4588');
    expect(secondBody.contents[0].parts[0].text).toContain('SL 4567');
  });

  it('falls back to deterministic parsing after all AI attempts fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'INVALID' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(
      service.parse('user-1', 'production', 'XAUUSD BUY ENTRY 4582 TP 4588 SL 4567')
    ).resolves.toEqual({
      symbol: 'XAUUSD',
      side: 'BUY',
      entry: 4582,
      takeProfit: 4588,
      stopLoss: 4567,
    });
  });
});
