import { Injectable, NotFoundException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { PlatformCredentialPort, SsiAuthInput } from '@tce/contracts';
import { SsiBrokerAdapter } from '@tce/ssi';
import { SsiExecutionReconciler } from './ssi.execution.reconciler';

@Injectable()
export class SsiApplicationService {
  private readonly sessions = new Map<string, { adapter: SsiBrokerAdapter; accountNo: string }>();

  constructor(
    @Inject('tce.contracts.credentials') private readonly credentials: PlatformCredentialPort,
    private readonly reconciler: SsiExecutionReconciler,
  ) {}

  private fromRaw(raw: Record<string, unknown>, environment: string) {
    const apiKey = String(raw.apiKey ?? ''), apiSecret = String(raw.apiSecret ?? ''), accountNo = String(raw.accountNo ?? '');
    if (!apiKey || !apiSecret || !accountNo) throw new NotFoundException(`SSI credentials are incomplete for environment: ${environment}`);
    return { adapter: new SsiBrokerAdapter({ apiKey, apiSecret, clientId: raw.clientId ? String(raw.clientId) : undefined, privateKey: raw.privateKey ? String(raw.privateKey) : undefined, accountNo }), accountNo };
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
    this.sessions.set(key, session);
    return session;
  }

  private async startOrderStream(userId: string, session: { adapter: SsiBrokerAdapter; accountNo: string }) {
    try {
      await session.adapter.startOrderStatusStream(session.accountNo, (event) => {
        void this.reconciler.reconcile(userId, session, event).catch((error) => console.error('[SSI_ORDER_RECONCILE]', error));
      });
    } catch (error) {
      console.error('[SSI_ORDER_STREAM_START]', error);
    }
  }

  async requestOtp(userId: string, environment: string, credentials?: Record<string, unknown>) {
    const { adapter } = credentials ? this.fromRaw(credentials, environment) : await this.adapter(userId, environment);
    return adapter.requestOtp();
  }

  async test(userId: string, environment: string, input: SsiAuthInput, credentials?: Record<string, unknown>) {
    const session = credentials ? this.fromRaw(credentials, environment) : await this.adapter(userId, environment);
    const result = await session.adapter.test(input);
    if (result.ok) {
      if (credentials) {
        await this.credentials.save(userId, 'ssi', environment, credentials);
        this.sessions.set(`${userId}:ssi:${environment}`, session);
      }
      void this.startOrderStream(userId, session);
    }
    return result;
  }

  async current(userId: string, environment: string, input: SsiAuthInput) { const { adapter, accountNo } = await this.adapter(userId, environment); return adapter.current(accountNo, input); }

  async sync(userId: string, environment: string, input: SsiAuthInput) {
    const session = await this.adapter(userId, environment);
    const snapshot = await session.adapter.syncPortfolio(session.accountNo, input);
    if (!snapshot.ok) return snapshot;
    let positionsSynced = 0;
    for (const position of snapshot.data.positions) { await this.reconciler['positions'].upsert({ ...position, accountId: userId }); positionsSynced += 1; }
    let ordersSynced = 0;
    for (const order of snapshot.data.orders) { await this.reconciler['orders'].upsert({ ...order, accountId: userId }); ordersSynced += 1; }
    void this.startOrderStream(userId, session);
    return { ok: true as const, data: { positionsSynced, ordersSynced, balance: snapshot.data.balance } };
  }
}
