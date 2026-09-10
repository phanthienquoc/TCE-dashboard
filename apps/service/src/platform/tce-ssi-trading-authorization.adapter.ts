import { Inject, Injectable } from '@nestjs/common';
import type {
  ContractResult,
  PlatformCredentialPort,
  TceTradingAuthorization,
  TceTradingAuthorizationContext,
  TceTradingAuthorizationPort,
} from '@tce/contracts';
import { CONTRACT_TOKENS } from '@tce/contracts';
import { SsiBrokerAdapter } from '@tce/ssi';
import { SupabaseClientService } from '../db/supabase.client';

type SsiCredentialRecord = Record<string, unknown>;

type AccountRecord = Readonly<{
  id: string;
  user_id: string;
  external_account_no?: string | null;
}>;

type SsiApprovalChallenge = Readonly<{
  transactionId?: string;
  message: string;
}>;

const nowIso = () => new Date().toISOString();

const unavailable = (
  context: TceTradingAuthorizationContext,
  message: string,
): ContractResult<TceTradingAuthorization> => ({
  ok: false,
  error: {
    code: 'UNAVAILABLE',
    message,
    retryable: true,
    provider: 'ssi',
  },
});

const authorizationState = (
  context: TceTradingAuthorizationContext,
  state: 'APPROVAL_REQUIRED' | 'EXPIRED',
): ContractResult<TceTradingAuthorization> => ({
  ok: true,
  data: {
    state,
    provider: 'ssi',
    accountId: context.accountId,
    environment: context.environment,
    checkedAt: nowIso(),
  },
});

export const mapSsiAuthorizationFailure = (
  context: TceTradingAuthorizationContext,
  message: string,
): ContractResult<TceTradingAuthorization> => {
  if (message.startsWith('SSI_REAUTH_REQUIRED')) return authorizationState(context, 'APPROVAL_REQUIRED');
  if (message.toLowerCase().includes('token expired')) return authorizationState(context, 'EXPIRED');
  return unavailable(context, message);
};

export const mapSsiApprovalChallenge = (
  context: TceTradingAuthorizationContext,
  challenge: SsiApprovalChallenge,
): ContractResult<Pick<TceTradingAuthorization, 'state' | 'provider' | 'accountId' | 'environment' | 'checkedAt' | 'transactionId' | 'approvalAction' | 'approvalMessage'>> => ({
  ok: true,
  data: {
    state: 'APPROVAL_REQUIRED',
    provider: 'ssi',
    accountId: context.accountId,
    environment: context.environment,
    checkedAt: nowIso(),
    transactionId: challenge.transactionId,
    approvalAction: 'APPROVE_OR_ENTER_OTP',
    approvalMessage: challenge.message,
  },
});

@Injectable()
export class TceSsiTradingAuthorizationAdapter implements TceTradingAuthorizationPort {
  constructor(
    @Inject(CONTRACT_TOKENS.credentials)
    private readonly credentials: PlatformCredentialPort,
    private readonly supabase: SupabaseClientService,
  ) {}

  async ensureAuthorized(
    context: TceTradingAuthorizationContext,
  ): Promise<ContractResult<TceTradingAuthorization>> {
    const account = await this.resolveAccount(context);
    if (!account.ok) return account;

    let raw: SsiCredentialRecord;
    try {
      raw = await this.credentials.get(account.data.userId, 'ssi', context.environment);
    } catch (error) {
      return unavailable(context, this.message(error, 'Unable to load SSI credentials'));
    }

    const accountNo = String(raw.accountNo ?? account.data.externalAccountNo ?? '').trim();
    if (!accountNo) return unavailable(context, 'SSI account is not selected for this environment');
    if (
      account.data.externalAccountNo &&
      String(account.data.externalAccountNo).trim() !== accountNo
    ) {
      return unavailable(context, 'SSI account does not match the selected TCE account');
    }

    const adapter = this.createAdapter(raw, account.data.userId, context.environment);
    const token = adapter.getTokenSnapshot();
    const checkedAt = nowIso();

    if (token?.accessToken && this.isFuture(token.expiresAt)) {
      return {
        ok: true,
        data: {
          state: 'READY',
          provider: 'ssi',
          accountId: context.accountId,
          environment: context.environment,
          checkedAt,
          expiresAt: this.epochToIso(token.expiresAt),
        },
      };
    }

    try {
      const connection = await adapter.connect({ userId: account.data.userId, environment: context.environment });
      if (!connection.ok) return mapSsiAuthorizationFailure(context, connection.error.message);

      const refreshed = adapter.getTokenSnapshot();
      if (refreshed?.accessToken && this.isFuture(refreshed.expiresAt)) {
        return {
          ok: true,
          data: {
            state: 'READY',
            provider: 'ssi',
            accountId: context.accountId,
            environment: context.environment,
            checkedAt: nowIso(),
            expiresAt: this.epochToIso(refreshed.expiresAt),
          },
        };
      }
      return unavailable(context, 'SSI authorization completed without a usable access token');
    } catch (error) {
      return mapSsiAuthorizationFailure(context, this.message(error, 'SSI authorization failed'));
    }
  }

  async requestApproval(
    context: TceTradingAuthorizationContext,
  ): Promise<ContractResult<Pick<TceTradingAuthorization, 'state' | 'provider' | 'accountId' | 'environment' | 'checkedAt' | 'transactionId' | 'approvalAction' | 'approvalMessage'>>> {
    const account = await this.resolveAccount(context);
    if (!account.ok) return account;

    let raw: SsiCredentialRecord;
    try {
      raw = await this.credentials.get(account.data.userId, 'ssi', context.environment);
    } catch (error) {
      return unavailable(context, this.message(error, 'Unable to load SSI credentials'));
    }

    const accountNo = String(raw.accountNo ?? account.data.externalAccountNo ?? '').trim();
    if (!accountNo) return unavailable(context, 'SSI account is not selected for this environment');
    if (
      account.data.externalAccountNo &&
      String(account.data.externalAccountNo).trim() !== accountNo
    ) {
      return unavailable(context, 'SSI account does not match the selected TCE account');
    }

    try {
      const adapter = this.createAdapter(raw, account.data.userId, context.environment);
      const challenge = await adapter.requestOtp();
      if (!challenge.ok) return mapSsiAuthorizationFailure(context, challenge.error.message);
      return mapSsiApprovalChallenge(context, challenge.data);
    } catch (error) {
      return mapSsiAuthorizationFailure(context, this.message(error, 'SSI approval request failed'));
    }
  }

  private async resolveAccount(
    context: TceTradingAuthorizationContext,
  ): Promise<ContractResult<Readonly<{ userId: string; externalAccountNo?: string | null }>>> {
    const { data, error } = await this.supabase.db
      .from('tce_accounts')
      .select('id,user_id,external_account_no')
      .eq('id', context.accountId)
      .maybeSingle();
    if (error) return unavailable(context, `Unable to resolve TCE account: ${error.message}`);
    if (!data?.user_id) return unavailable(context, 'TCE account is not configured');
    const record = data as AccountRecord;
    return {
      ok: true,
      data: { userId: String(record.user_id), externalAccountNo: record.external_account_no },
    };
  }

  private createAdapter(raw: SsiCredentialRecord, userId: string, environment: string) {
    return new SsiBrokerAdapter({
      apiKey: String(raw.apiKey ?? ''),
      apiSecret: String(raw.apiSecret ?? ''),
      clientId: raw.clientId ? String(raw.clientId) : undefined,
      privateKey: raw.privateKey ? String(raw.privateKey) : undefined,
      accountNo: raw.accountNo ? String(raw.accountNo) : undefined,
      token: {
        accessToken: raw.accessToken ? String(raw.accessToken) : undefined,
        tokenType: raw.tokenType ? String(raw.tokenType) : undefined,
        expiresAt: raw.expiresAt ? Number(raw.expiresAt) : undefined,
        refreshToken: raw.refreshToken ? String(raw.refreshToken) : undefined,
        refreshTokenExpiresAt: raw.refreshTokenExpiresAt ? Number(raw.refreshTokenExpiresAt) : undefined,
        refreshExpiresAt: raw.refreshExpiresAt ? Number(raw.refreshExpiresAt) : undefined,
      },
      onTokenUpdated: async token => {
        await this.credentials.save(userId, 'ssi', environment, { ...raw, ...token });
      },
    });
  }

  private isFuture(epoch: number) {
    if (!Number.isFinite(epoch) || epoch <= 0) return false;
    const seconds = epoch < 1e12 ? epoch : epoch / 1000;
    return seconds > Date.now() / 1000 + 5;
  }

  private epochToIso(epoch: number) {
    const milliseconds = epoch < 1e12 ? epoch * 1000 : epoch;
    return new Date(milliseconds).toISOString();
  }

  private message(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : error ? String(error) : fallback;
  }
}
