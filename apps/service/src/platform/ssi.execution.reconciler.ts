import { Injectable, Logger, Inject } from '@nestjs/common';
import { AccountOrder, CONTRACT_TOKENS, OrderRepository, PositionRepository } from '@tce/contracts';
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
  ) {}

  async reconcile(accountId: string, session: { adapter: SsiBrokerAdapter; accountNo: string }, event: SsiOrderStatusEvent) {
    if (!event.orderId || !event.symbol) return { ignored: true as const, reason: 'missing_order_identity' };
    const status = String(event.status ?? 'UNKNOWN').toUpperCase();
    const side = String(event.side ?? '').toUpperCase() === 'S' ? 'SELL' : 'BUY';
    const filledQuantity = Number(event.filledQuantity ?? 0);
    const eventQuantity = Number(event.quantity ?? 0);
    const quantity = filledQuantity > 0 ? filledQuantity : eventQuantity;
    const price = Number(event.price ?? 0);
    const order: AccountOrder = { externalId: String(event.orderId), symbol: String(event.symbol).toUpperCase(), side, quantity, price, status, createdAt: event.inputTime, source: 'ssi', accountId };
    await this.orders.upsert(order);
    if (!TERMINAL.has(status) || (!FILLED.has(status) && !PARTIAL.has(status) && filledQuantity <= 0)) return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: false };
    const snapshot = await session.adapter.positions(session.accountNo);
    if (!snapshot.ok) {
      this.logger.warn(`SSI position reconciliation failed for ${event.orderId}`);
      return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: false };
    }
    for (const position of snapshot.data) await this.positions.upsert({ ...position, accountId });
    return { ignored: false as const, status, filled: FILLED.has(status), partial: PARTIAL.has(status), positionSynced: true, filledQuantity, eventQuantity };
  }
}
