import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PlatformCredentialsService } from './platform-credentials.service';

const SSI_BASE_URL = 'https://api.ssi.com.vn';

type SsiCredentials = {
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  privateKey?: string;
  accountNo?: string;
};

type SsiAuthInput = { otp?: string; transactionId?: string };

@Injectable()
export class SsiService {
  constructor(private readonly credentials: PlatformCredentialsService) {}

  private async load(userId: string, environment: string) {
    if (environment !== 'production') throw new ServiceUnavailableException('SSI UAT endpoint is not configured');
    const { credentials } = await this.credentials.getDecrypted(userId, 'ssi', environment) as { id: string; credentials: SsiCredentials };
    if (!credentials.apiKey || !credentials.apiSecret) throw new ServiceUnavailableException('SSI API Key and API Secret are required');
    return credentials;
  }

  async requestOtp(userId: string, environment = 'production') {
    const credentials = await this.load(userId, environment);
    const response = await fetch(`${SSI_BASE_URL}/api/v3/auth/requestOtp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apiKey: credentials.apiKey, apiSecret: credentials.apiSecret }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(`SSI OTP request failed: ${body.msg ?? body.message ?? `HTTP ${response.status}`}`);
    return { ok: true, message: body.message ?? 'SSI approval/OTP request sent', transactionId: body.transactionId ?? null };
  }

  async test(userId: string, environment = 'production', authInput: SsiAuthInput = {}) {
    const credentials = await this.load(userId, environment);
    const tokenResponse = await fetch(`${SSI_BASE_URL}/api/v3/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        ...(authInput.otp ? { otp: authInput.otp } : {}),
        ...(authInput.transactionId ? { transactionId: authInput.transactionId } : {}),
      }),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenBody.accessToken) {
      throw new ServiceUnavailableException(`SSI authentication failed: ${tokenBody.msg ?? tokenBody.message ?? `HTTP ${tokenResponse.status}`}`);
    }

    const dataResponse = await fetch(`${SSI_BASE_URL}/api/v3/data/securitiesByBoard?board=HOSE`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${tokenBody.accessToken}` },
    });
    const dataBody = await dataResponse.json().catch(() => ({}));
    if (!dataResponse.ok) throw new ServiceUnavailableException(`SSI market-data check failed: ${dataBody.msg ?? dataBody.message ?? `HTTP ${dataResponse.status}`}`);

    return {
      ok: true,
      provider: 'ssi',
      environment,
      authentication: 'ok',
      marketData: 'ok',
      tokenExpiresAt: tokenBody.expiresAt ?? null,
      rateLimit: {
        limit: dataResponse.headers.get('x-ratelimit-limit'),
        remaining: dataResponse.headers.get('x-ratelimit-remaining'),
        reset: dataResponse.headers.get('x-ratelimit-reset'),
      },
    };
  }
}
