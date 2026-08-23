import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Auth, Data, Config, Board } from '@ssi.developer/ssi-sdk';
import { PlatformCredentialsService } from './platform-credentials.service';

const SSI_BASE_URL = 'https://api.ssi.com.vn';
const SSI_STREAM_URL = 'wss://stream.ssi.com.vn/ws/v3';

type SsiCredentials = { apiKey?: string; apiSecret?: string; clientId?: string; privateKey?: string; accountNo?: string };
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

  private createAuth(credentials: SsiCredentials) {
    return new Auth(new Config({
      clientId: credentials.clientId ?? '',
      apiKey: credentials.apiKey ?? '',
      apiSecret: credentials.apiSecret ?? '',
      privateKey: credentials.privateKey ?? '',
      apiUrl: SSI_BASE_URL,
      streamingUrl: SSI_STREAM_URL,
      timeout: 60000,
      maxRetries: 5,
      retryDelay: 2000,
      rateLimitPerSecond: 10,
    }));
  }

  async requestOtp(userId: string, environment = 'production') {
    try {
      const auth = this.createAuth(await this.load(userId, environment));
      const result = await auth.requestOtp();
      const data = (result?.data ?? {}) as Record<string, unknown>;
      return { ok: true, message: String(data.message ?? 'SSI approval/OTP request sent'), transactionId: typeof data.transactionId === 'string' ? data.transactionId : null };
    } catch (error) {
      throw this.ssiError('SSI OTP request failed', error);
    }
  }

  async test(userId: string, environment = 'production', authInput: SsiAuthInput = {}) {
    try {
      const auth = this.createAuth(await this.load(userId, environment));
      const token = authInput.transactionId
        ? await auth.authenticate(undefined, authInput.transactionId)
        : await auth.authenticate(authInput.otp);
      const data = new Data(auth);
      const securities = await data.marketData.getSecuritiesInfoByBoard(Board.HOSE);
      return { ok: true, provider: 'ssi', sdk: '@ssi.developer/ssi-sdk@3.2.x', apiVersion: 'v3', environment, authentication: 'ok', marketData: 'ok', securities: securities.length, tokenExpiresAt: token?.expiresAt ?? auth.getToken()?.expiresAt ?? null };
    } catch (error) {
      throw this.ssiError('SSI authentication/market-data check failed', error);
    }
  }

  private ssiError(prefix: string, error: unknown) {
    return new ServiceUnavailableException(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
