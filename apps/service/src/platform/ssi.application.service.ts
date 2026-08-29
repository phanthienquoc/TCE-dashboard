import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  CONTRACT_TOKENS,
  BrokerOrderRequest,
  BrokerOrderResult,
  ContractResult,
  OrderRepository,
  PlatformCredentialPort,
  PositionRepository,
  SsiAuthInput,
} from '@tce/contracts';
import { Inject } from '@nestjs/common';
import { SsiBrokerAdapter, SsiOrderStatusEvent, SsiTokenSnapshot } from '@tce/ssi';
import { SupabaseClientService } from '../db/supabase.client';

@Injectable()
export class SsiApplicationService {
  private readonly sessions = new Map<string, { adapter: SsiBrokerAdapter; accountNo: string }>();

  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort,
    @Inject(CONTRACT_TOKENS.positionRepository) private readonly positions: PositionRepository,
    @Inject(CONTRACT_TOKENS.orderRepository) private readonly orders: OrderRepository,
    private readonly supabase: SupabaseClientService
  ) {}

  private fromRaw(
    raw: Record<string, unknown>,
    userId: string,
    environment: string,
    accountNoOverride?: string,
    persistToken = false
  ) {
    const apiKey = String(raw.apiKey ?? ''),
      apiSecret = String(raw.apiSecret ?? ''),
      accountNo = String(accountNoOverride ?? raw.accountNo ?? '');
    if (!apiKey || !apiSecret)
      throw new NotFoundException(`SSI credentials are incomplete for environment: ${environment}`);
    const onTokenUpdated = persistToken
      ? async (token: SsiTokenSnapshot) => {
          await this.credentials.save(userId, 'ssi', environment, { ...raw, ...token });
        }
      : undefined;
    return {
      adapter: new SsiBrokerAdapter({
        apiKey,
        apiSecret,
        clientId: raw.clientId ? String(raw.clientId) : undefined,
        privateKey: raw.privateKey ? String(raw.privateKey) : undefined,
        accountNo: accountNo || undefined,
        token: {
          accessToken: raw.accessToken ? String(raw.accessToken) : undefined,
          tokenType: raw.tokenType ? String(raw.tokenType) : undefined,
          expiresAt: raw.expiresAt ? Number(raw.expiresAt) : undefined,
          refreshToken: raw.refreshToken ? String(raw.refreshToken) : undefined,
          refreshTokenExpiresAt: raw.refreshTokenExpiresAt
            ? Number(raw.refreshTokenExpiresAt)
            : undefined,
          refreshExpiresAt: raw.refreshExpiresAt ? Number(raw.refreshExpiresAt) : undefined,
        },
        onTokenUpdated,
      }),
      accountNo,
    };
  }

  private async adapter(userId: string, environment: string, requireAccount = true) {
    let raw: Record<string, unknown>;
    try {
      raw = await this.credentials.get(userId, 'ssi', environment);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Platform credentials not configured')
        throw new NotFoundException(
          `SSI credentials are not configured for environment: ${environment}`
        );
      console.error('[SSI_CREDENTIALS_LOAD]', { userId, environment, message });
      throw new ServiceUnavailableException('Unable to load SSI credentials');
    }
    const session = this.fromRaw(raw, userId, environment, undefined, true);
    if (requireAccount && !session.accountNo)
      throw new NotFoundException(`SSI account is not selected for environment: ${environment}`);
    return session;
  }

  private async tceAccountId(userId: string) {
    const { data, error } = await this.supabase.db
      .from('tce_accounts')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new NotFoundException('TCE account is not configured');
    return String(data.id);
  }

  private async handleOrderEvent(
    accountId: string,
    session: { adapter: SsiBrokerAdapter; accountNo: string },
    event: SsiOrderStatusEvent
  ) {
    if (!event.orderId || !event.symbol) return;
    await this.orders.upsert({
      externalId: String(event.orderId),
      symbol: String(event.symbol).toUpperCase(),
      side: String(event.side).toUpperCase() === 'S' ? 'SELL' : 'BUY',
      quantity: Number(event.filledQuantity ?? event.quantity ?? 0),
      price: Number(event.price ?? 0),
      status: String(event.status ?? 'UNKNOWN'),
      createdAt: event.inputTime,
      source: 'ssi',
      accountId,
    });
    if (event.status === 'FF' || event.status === 'PF' || event.status === 'FFPC') {
      const positions = await session.adapter.positions(session.accountNo);
      if (positions.ok)
        for (const position of positions.data)
          await this.positions.upsert({ ...position, accountId });
    }
  }

  private async startOrderStream(
    accountId: string,
    session: { adapter: SsiBrokerAdapter; accountNo: string }
  ) {
    try {
      await session.adapter.startOrderStatusStream(session.accountNo, event => {
        void this.handleOrderEvent(accountId, session, event).catch(error =>
          console.error('[SSI_ORDER_EVENT]', error)
        );
      });
    } catch (error) {
      console.error('[SSI_ORDER_STREAM_START]', error);
    }
  }
  private storeSession(
    userId: string,
    environment: string,
    session: { adapter: SsiBrokerAdapter; accountNo: string }
  ) {
    this.sessions.set(`${userId}:ssi:${environment}`, session);
  }

  async requestOtp(userId: string, environment: string, credentials: Record<string, unknown>) {
    const { adapter } = this.fromRaw(credentials, userId, environment);
    return adapter.requestOtp();
  }
  async approve(
    userId: string,
    environment: string,
    input: SsiAuthInput,
    credentials: Record<string, unknown>
  ) {
    const session = this.fromRaw(credentials, userId, environment, undefined, true);
    const result = await session.adapter.connect({ userId, environment, ...input });
    if (!result.ok) return result;
    const token = session.adapter.getTokenSnapshot();
    const finalSession = token
      ? this.fromRaw({ ...credentials, ...token }, userId, environment, undefined, true)
      : session;
    this.storeSession(userId, environment, finalSession);
    if (finalSession.accountNo)
      void this.startOrderStream(await this.tceAccountId(userId), finalSession);
    return { ok: true as const, data: { authentication: 'ok' as const, provider: 'ssi' as const } };
  }
  async test(
    userId: string,
    environment: string,
    input: SsiAuthInput,
    credentials?: Record<string, unknown>
  ) {
    const key = `${userId}:ssi:${environment}`;
    const existing = this.sessions.get(key);
    const session =
      credentials && !input.otp?.trim() && !input.transactionId?.trim() && existing
        ? existing
        : credentials
          ? this.fromRaw(credentials, userId, environment)
          : await this.adapter(userId, environment);
    if (!input.otp?.trim() && !input.transactionId?.trim() && !existing) {
      const challenge = await session.adapter.requestOtp();
      if (!challenge.ok) return challenge;
      return {
        ok: false as const,
        error: {
          code: 'PROVIDER_ERROR' as const,
          message: 'SSI_AUTH_REQUIRED' as const,
          retryable: false,
          provider: 'ssi',
          details: {
            transactionId: challenge.data.transactionId,
            message: challenge.data.message,
            action: 'APPROVE_OR_ENTER_OTP',
          },
        },
      };
    }
    const result = await session.adapter.test(input);
    if (!result.ok) return result;
    const token = session.adapter.getTokenSnapshot();
    const testedCredentials = token ? { ...credentials, ...token } : credentials;
    const finalSession =
      credentials && !existing
        ? this.fromRaw(testedCredentials!, userId, environment, undefined, true)
        : session;
    this.storeSession(userId, environment, finalSession);
    if (finalSession.accountNo)
      void this.startOrderStream(await this.tceAccountId(userId), finalSession);
    return result;
  }
  async saveTested(
    userId: string,
    environment: string,
    credentials: Record<string, unknown>,
    input: SsiAuthInput,
    accountNo: string
  ) {
    if (!accountNo) throw new NotFoundException('SSI account number is required');
    const key = `${userId}:ssi:${environment}`;
    const existing = this.sessions.get(key);
    if (existing) {
      const token = existing.adapter.getTokenSnapshot();
      const persistedCredentials = { ...credentials, accountNo, ...(token ?? {}) };
      await this.credentials.save(userId, 'ssi', environment, persistedCredentials);
      const persisted = this.fromRaw(persistedCredentials, userId, environment, accountNo, true);
      this.storeSession(userId, environment, persisted);
      void this.startOrderStream(await this.tceAccountId(userId), persisted);
      return { ok: true as const, data: { saved: true as const, provider: 'ssi' as const } };
    }
    const session = this.fromRaw(credentials, userId, environment, accountNo);
    const result = await session.adapter.test(input);
    if (!result.ok) return result;
    const token = session.adapter.getTokenSnapshot();
    const persistedCredentials = { ...credentials, accountNo, ...(token ?? {}) };
    await this.credentials.save(userId, 'ssi', environment, persistedCredentials);
    const persisted = this.fromRaw(persistedCredentials, userId, environment, accountNo, true);
    this.storeSession(userId, environment, persisted);
    void this.startOrderStream(await this.tceAccountId(userId), persisted);
    return result;
  }
  async current(userId: string, environment: string, input: SsiAuthInput) {
    const { adapter, accountNo } = await this.adapter(userId, environment);
    return adapter.current(accountNo, input);
  }
  async accountSnapshots(userId: string, environment: string, input: SsiAuthInput) {
    const key = `${userId}:ssi:${environment}`;
    const existing = this.sessions.get(key);
    if (existing) return existing.adapter.accountSnapshots(input);
    const { adapter } = await this.adapter(userId, environment, false);
    return adapter.accountSnapshots(input);
  }
  async marketPrices(userId: string, environment: string, symbols: string[]) {
    const { adapter } = await this.adapter(userId, environment, false);
    return adapter.marketPrices(symbols);
  }
  async dailyCloses(userId: string, environment: string, symbols: string[], tradingDate: string) {
    const { adapter } = await this.adapter(userId, environment, false);
    return adapter.dailyCloses(symbols, tradingDate);
  }

  async placeOrder(
    userId: string,
    environment: string,
    request: Omit<BrokerOrderRequest, 'accountNo'> & { accountNo?: string }
  ) {
    const key = `${userId}:ssi:${environment}`;
    const existing = this.sessions.get(key);
    const session = existing ?? (await this.adapter(userId, environment));
    const accountNo = request.accountNo ?? session.accountNo;
    if (!accountNo)
      throw new NotFoundException(`SSI account is not selected for environment: ${environment}`);
    const result = await session.adapter.placeOrder({ ...request, accountNo });
    if (result.ok)
      void this.startOrderStream(await this.tceAccountId(userId), { ...session, accountNo });
    return result as ContractResult<BrokerOrderResult>;
  }
}
