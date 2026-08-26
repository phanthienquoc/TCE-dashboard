import { Injectable, Logger, Inject } from '@nestjs/common';
import { AccountOrder, CONTRACT_TOKENS, OrderRepository, PositionRepository, TceAccountRepository } from '@tce/contracts';
import { SsiBrokerAdapter, SsiOrderStatusEvent } from '@tce/ssi';

const FILLED = new Set(['FF', 'FFPC']);
const PARTIAL = new Set(['PF']);
const TERMINAL = new Set(['FF', 'FFPC', 'PF', 'CN', 'RJ', 'RE', 'CXL', 'EX']);

@Injectable()
export class SsiExecutionReconciler {
  private readonly logger = new Logger(SsiExecutionReconciler.name);

  constructor(
    @Inject(CONTRACT_TOKENS.orderRepository) private readonly orders: OrderRepository,
    @Inject(CONTRACT_TOKENS.positionRepository) private readonly positions: PositionRepository,
    @Inject(CONTRACT_TOKENS.tceAccountRepository) private readonly accounts: TceAccountRepository,
  ) {}

  async reconcile(userId: string, session: { adapter: SsiBrokerAdapter; accountNo: string }, event: SsiOrderStatusEvent) {
    if (!event.orderId || !event.symbol) return { ignored: true as const, reason: 'missing_order_identity' };
    const accountId = await this.accounts.resolveForUser(userId);
    const status = String(event.status ?? 'UNKNOWN').toUpperCase();
    const side = String(event.side ?? '').toUpperCase() === 'S' ? 'SELL' : 'BUY';
    const filledQuantity = Number(event.filledQuantity ?? 0);
    const eventQuantity = Number(event.quantity ?? 0);
    const quantity = filledQuantity > 0 ? filledQuantity : eventQuantity;
    const price = Number(event.price ?? 0);
    const order: AccountOrder = { externalId: String(event.orderId), symbol: String(event.symbol).toUpperCase(), side, quantity, price, status, createdAt: event.inputTime, source: 'ssi', accountId, userId };
    await this.orders.upsert(order);
    if (!TERMINAL.has(status) || (!FILLED.has(status) && !PARTIAL.has(status) && filledQuantity <= 0)) return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: false, accountId };
    const snapshot = await session.adapter.positions(session.accountNo);
    if (!snapshot.ok) {
      this.logger.warn(`SSI position reconciliation failed for ${event.orderId}`);
      return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: false, accountId };
    }
    for (const position of snapshot.data) await this.positions.upsert({ ...position, accountId, userId });
    return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: true, filledQuantity, eventQuantity, accountId };
  }
}
