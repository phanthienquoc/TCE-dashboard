import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CONTRACT_TOKENS, OrderRepository, PlatformCredentialPort, PositionRepository, SsiAuthInput } from '@tce/contracts';
import { Inject } from '@nestjs/common';
import { SsiBrokerAdapter } from '@tce/ssi';

@Injectable()
export class SsiApplicationService {
  constructor(
    @Inject(CONTRACT_TOKENS.credentials) private readonly credentials: PlatformCredentialPort,
    @Inject(CONTRACT_TOKENS.positionRepository) private readonly positions: PositionRepository,
    @Inject(CONTRACT_TOKENS.orderRepository) private readonly orders: OrderRepository,
  ) {}

  private fromRaw(raw: Record<string, unknown>, environment: string) {
    const apiKey = String(raw.apiKey ?? ''), apiSecret = String(raw.apiSecret ?? ''), accountNo = String(raw.accountNo ?? '');
    if (!apiKey || !apiSecret || !accountNo) throw new NotFoundException(`SSI credentials are incomplete for environment: ${environment}`);
    return { adapter: new SsiBrokerAdapter({ apiKey, apiSecret, clientId: raw.clientId ? String(raw.clientId) : undefined, privateKey: raw.privateKey ? String(raw.privateKey) : undefined, accountNo }), accountNo };
  }

  private async adapter(userId: string, environment: string) {
    let raw: Record<string, unknown>;
    try { raw = await this.credentials.get(userId, 'ssi', environment); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Platform credentials not configured') throw new NotFoundException(`SSI credentials are not configured for environment: ${environment}`);
      console.error('[SSI_CREDENTIALS_LOAD]', { userId, environment, message });
      throw new ServiceUnavailableException('Unable to load SSI credentials');
    }
    return this.fromRaw(raw, environment);
  }

  async requestOtp(userId: string, environment: string, credentials?: Record<string, unknown>) {
    const { adapter } = credentials ? this.fromRaw(credentials, environment) : await this.adapter(userId, environment);
    return adapter.requestOtp();
  }

  async test(userId: string, environment: string, input: SsiAuthInput, credentials?: Record<string, unknown>) {
    const result = await (credentials ? this.fromRaw(credentials, environment).adapter.test(input) : (await this.adapter(userId, environment)).adapter.test(input));
    if (result.ok && credentials) await this.credentials.save(userId, 'ssi', environment, credentials);
    return result;
  }

  async current(userId: string, environment: string, input: SsiAuthInput) { const { adapter, accountNo } = await this.adapter(userId, environment); return adapter.current(accountNo, input); }

  async sync(userId: string, environment: string, input: SsiAuthInput) {
    const { adapter, accountNo } = await this.adapter(userId, environment);
    const snapshot = await adapter.syncPortfolio(accountNo, input);
    if (!snapshot.ok) return snapshot;
    let positionsSynced = 0;
    for (const position of snapshot.data.positions) { await this.positions.upsert({ ...position, accountId: userId }); positionsSynced += 1; }
    let ordersSynced = 0;
    for (const order of snapshot.data.orders) { await this.orders.upsert({ ...order, accountId: userId }); ordersSynced += 1; }
    return { ok: true as const, data: { positionsSynced, ordersSynced, balance: snapshot.data.balance } };
  }
}
