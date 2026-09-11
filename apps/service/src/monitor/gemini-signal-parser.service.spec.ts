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
  it('parses canonical four-line output into Binance-ready entry fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: 'XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567' }] } },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
    await expect(
      service.parse('user-1', 'production', 'XAUUSD buy entry 4582 tp 4588 sl 4567')
    ).resolves.toMatchObject({
      symbol: 'XAUUSDT',
      side: 'BUY',
      entry: 4582,
      takeProfit: 4588,
      stopLoss: 4567,
      orderType: 'LIMIT',
      price: 4582,
      positionSide: 'BOTH',
      timeInForce: 'GTC',
      reduceOnly: false,
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
              { content: { parts: [{ text: 'XAUUSD BUY\nENTRY 4582\nTP 4588\nSL 4567' }] } },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      service.parse('user-1', 'production', 'Signal for XAUUSD: BUY 4582 / TP 4588 / SL 4567')
    ).resolves.toMatchObject({ symbol: 'XAUUSDT', side: 'BUY', entry: 4582 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(secondBody.contents[0].parts[0].text).toContain('Previous parse failure:');
  });
  it('marks the signal when deterministic fallback is used after AI failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'INVALID' }] } }] }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
    );
    await expect(
      service.parse('user-1', 'production', `#XAUUSD BUY NOW
4338__4334

TP 4342
TP 4346
TP 4350
TP 4355
TP 4360
TP 4380

SL 4324`)
    ).resolves.toMatchObject({
      symbol: 'XAUUSDT',
      side: 'BUY',
      entry: 4339,
      takeProfit: 4346,
      stopLoss: 4324,
      agentNote: expect.stringContaining('AI parse failed after 3 attempt(s)'),
    });
  });
  it('exposes both AI and fallback errors when the deterministic parser also fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'INVALID' }] } }] }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
    );
    await expect(
      service.parse('user-1', 'production', '#XAUUSD BUY NOW\nnot-an-entry-zone')
    ).rejects.toThrow(
      'AI parse failed after 3 attempt(s). Deterministic fallback also failed:'
    );
  });
});
