import { Injectable, NotFoundException } from '@nestjs/common';
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

  private async adapter(userId: string, environment: string) {
    const raw = await this.credentials.get(userId, 'ssi', environment);
    const apiKey = String(raw.apiKey ?? ''), apiSecret = String(raw.apiSecret ?? ''), accountNo = String(raw.accountNo ?? '');
    if (!apiKey || !apiSecret || !accountNo) throw new NotFoundException('SSI API credentials and accountNo are required');
    return { adapter: new SsiBrokerAdapter({ apiKey, apiSecret, clientId: raw.clientId ? String(raw.clientId) : undefined, privateKey: raw.privateKey ? String(raw.privateKey) : undefined, accountNo }), accountNo };
  }

  async requestOtp(userId: string, environment: string) { const { adapter } = await this.adapter(userId, environment); return adapter.requestOtp(); }
  async test(userId: string, environment: string, input: SsiAuthInput) { const { adapter } = await this.adapter(userId, environment); return adapter.test(input); }
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
