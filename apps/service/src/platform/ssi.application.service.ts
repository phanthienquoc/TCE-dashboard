import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CONTRACT_TOKENS, OrderRepository, PlatformCredentialPort, PositionRepository, SsiAuthInput } from '@tce/contracts';
import { Inject } from '@nestjs/common';
import { SsiBrokerAdapter, SsiOrderStatusEvent } from '@tce/ssi';

@Injectable()
export class SsiApplicationService {
  private readonly sessions = new Map<string, { adapter: SsiBrokerAdapter; accountNo: string }>();

  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort,
    @Inject(CONTRACT_TOKENS.positionRepository) private readonly positions: PositionRepository,
    @Inject(CONTRACT_TOKENS.orderRepository) private readonly orders: OrderRepository,
  ) {}

  private fromRaw(raw: Record<string, unknown>, environment: string, accountNoOverride?: string) {
    const apiKey = String(raw.apiKey ?? ''), apiSecret = String(raw.apiSecret ?? ''), accountNo = String(accountNoOverride ?? raw.accountNo ?? '');
    if (!apiKey || !apiSecret) throw new NotFoundException(`SSI credentials are incomplete for environment: ${environment}`);
    return { adapter: new SsiBrokerAdapter({ apiKey, apiSecret, clientId: raw.clientId ? String(raw.clientId) : undefined, privateKey: raw.privateKey ? String(raw.privateKey) : undefined, accountNo: accountNo || undefined }), accountNo };
  }

  private async adapter(userId: string, environment: string) {
    const key = `${userId}:ssi:${environment}`;
    const cached = this.sessions.get(key);
    if (cached) return cached;
    let raw: Record<string, unknown>;
    try { raw = await this.credentials.get(userId, 'ssi', environment); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Platform credentials not configured') throw new NotFoundException(`SSI credentials are not configured for environment: ${environment}`);
      console.error('[SSI_CREDENTIALS_LOAD]', { userId, environment, message });
      throw new ServiceUnavailableException('Unable to load SSI credentials');
    }
    const session = this.fromRaw(raw, environment);
    if (!session.accountNo) throw new NotFoundException(`SSI account is not selected for environment: ${environment}`);
    this.sessions.set(key, session);
    return session;
  }

  private async handleOrderEvent(userId: string, session: { adapter: SsiBrokerAdapter; accountNo: string }, event: SsiOrderStatusEvent) {
    if (!event.orderId || !event.symbol) return;
    await this.orders.upsert({ externalId: String(event.orderId), symbol: String(event.symbol).toUpperCase(), side: String(event.side).toUpperCase() === 'S' ? 'SELL' : 'BUY', quantity: Number(event.filledQuantity ?? event.quantity ?? 0), price: Number(event.price ?? 0), status: String(event.status ?? 'UNKNOWN'), createdAt: event.inputTime, source: 'ssi', accountId: userId });
    if (event.status === 'FF' || event.status === 'PF' || event.status === 'FFPC') {
      const positions = await session.adapter.positions(session.accountNo);
      if (positions.ok) for (const position of positions.data) await this.positions.upsert({ ...position, accountId: userId });
    }
  }

  private async startOrderStream(userId: string, session: { adapter: SsiBrokerAdapter; accountNo: string }) {
    try { await session.adapter.startOrderStatusStream(session.accountNo, (event) => { void this.handleOrderEvent(userId, session, event).catch((error) => console.error('[SSI_ORDER_EVENT]', error)); }); }
    catch (error) { console.error('[SSI_ORDER_STREAM_START]', error); }
  }

  async requestOtp(userId: string, environment: string, credentials?: Record<string, unknown>) {
    const { adapter } = credentials ? this.fromRaw(credentials, environment) : await this.adapter(userId, environment);
    return adapter.requestOtp();
  }

  async test(userId: string, environment: string, input: SsiAuthInput, credentials?: Record<string, unknown>) {
    const session = credentials ? this.fromRaw(credentials, environment) : await this.adapter(userId, environment);
    const result = await session.adapter.test(input);
    if (result.ok && credentials) this.sessions.set(`${userId}:ssi:${environment}`, { ...session, accountNo: session.accountNo });
    if (result.ok && session.accountNo) void this.startOrderStream(userId, { ...session, accountNo: session.accountNo });
    return result;
  }

  async saveTested(userId: string, environment: string, credentials: Record<string, unknown>, input: SsiAuthInput, accountNo: string) {
    if (!accountNo) throw new NotFoundException('SSI account number is required');
    const session = this.fromRaw(credentials, environment, accountNo);
    const result = await session.adapter.test(input);
    if (!result.ok) return result;
    await this.credentials.save(userId, 'ssi', environment, { ...credentials, accountNo });
    this.sessions.set(`${userId}:ssi:${environment}`, session);
    void this.startOrderStream(userId, session);
    return result;
  }

  async current(userId: string, environment: string, input: SsiAuthInput) { const { adapter, accountNo } = await this.adapter(userId, environment); return adapter.current(accountNo, input); }

  async sync(userId: string, environment: string, input: SsiAuthInput) {
    const session = await this.adapter(userId, environment);
    const snapshot = await session.adapter.syncPortfolio(session.accountNo, input);
    if (!snapshot.ok) return snapshot;
    let positionsSynced = 0;
    for (const position of snapshot.data.positions) { await this.positions.upsert({ ...position, accountId: userId }); positionsSynced += 1; }
    let ordersSynced = 0;
    for (const order of snapshot.data.orders) { await this.orders.upsert({ ...order, accountId: userId }); ordersSynced += 1; }
    void this.startOrderStream(userId, session);
    return { ok: true as const, data: { positionsSynced, ordersSynced, balance: snapshot.data.balance } };
  }
}
