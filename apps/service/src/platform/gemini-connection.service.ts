import { Injectable } from '@nestjs/common';

export type GeminiConnectionResult = {
  ok: true;
  model: string;
  message: string;
};

@Injectable()
export class GeminiConnectionService {
  private readonly timeoutMs = 8000;
  private readonly demoPrompt = 'Explain how AI works in a few words';

  async testConnection(apiKey: string, model: string): Promise<GeminiConnectionResult> {
    const normalizedKey = apiKey.trim();
    const normalizedModel = model.replace(/^models\//i, '').trim();
    if (!normalizedKey) throw new Error('Gemini API key is required');
    if (!normalizedModel) throw new Error('Gemini model is required');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': normalizedKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: this.demoPrompt }],
                },
              ],
            }),
            signal: controller.signal,
          }
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          throw new Error('Gemini connection timed out');
        throw new Error('Gemini provider is unreachable');
      }

      if (!response.ok) throw new Error(this.mapHttpFailure(response.status));

      const body = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? '')
        .join('')
        .trim();
      if (!text) throw new Error('Gemini returned an empty response');

      return {
        ok: true,
        model: normalizedModel,
        message: 'Gemini connection successful.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapHttpFailure(status: number): string {
    if (status === 401) return 'Gemini authentication failed. Check the API key.';
    if (status === 403) return 'Gemini access denied. Check API access and billing/quota settings.';
    if (status === 404) return 'Gemini model was not found or is unavailable for this API key.';
    if (status === 429) return 'Gemini quota or rate limit reached.';
    if (status >= 500) return 'Gemini provider is temporarily unavailable.';
    return `Gemini request failed (HTTP ${status}).`;
  }
}
