import { Injectable } from '@nestjs/common';

export type GeminiConnectionResult = {
  ok: true;
  model: string;
  message: string;
};

@Injectable()
export class GeminiConnectionService {
  private readonly timeoutMs = 15000;
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
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent?key=${encodeURIComponent(normalizedKey)}`,
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: this.demoPrompt }],
                },
              ],
              generationConfig: {
                maxOutputTokens: 32,
                temperature: 0,
              },
            }),
            signal: controller.signal,
          }
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('Gemini connection timed out');
        }
        throw new Error('Gemini provider is unreachable');
      }

      if (!response.ok) {
        let providerMessage = '';
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          providerMessage =
            typeof body.error?.message === 'string' ? body.error.message.trim() : '';
        } catch {
          // Keep the stable mapped error below when the provider response is not JSON.
        }
        throw new Error(this.mapHttpFailure(response.status, providerMessage));
      }

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

  private mapHttpFailure(status: number, providerMessage = ''): string {
    if (status === 400) {
      if (/api.?key|key/i.test(providerMessage))
        return 'Gemini request rejected. Check the API key and request configuration.';
      if (/model/i.test(providerMessage))
        return 'Gemini model request is invalid for this API version.';
      return 'Gemini request was rejected. Check the API key and model.';
    }
    if (status === 401) return 'Gemini authentication failed. Check the API key.';
    if (status === 403) return 'Gemini access denied. Check API access and billing/quota settings.';
    if (status === 404) return 'Gemini model was not found or is unavailable for this API key.';
    if (status === 429) return 'Gemini quota or rate limit reached.';
    if (status >= 500) return 'Gemini provider is temporarily unavailable.';
    return `Gemini request failed (HTTP ${status}).`;
  }
}
