import type { AccountOrder } from '@tce/contracts';
import type { SsiOrderStatusEvent } from './ssi.broker.adapter';

export const isSsiFillStatus = (status?: string) => status === 'FF' || status === 'PF' || status === 'FFPC';

export const toAccountOrder = (event: SsiOrderStatusEvent, accountId: string): AccountOrder | null => {
  if (!event.orderId || !event.symbol) return null;
  return {
    externalId: String(event.orderId),
    symbol: String(event.symbol).toUpperCase(),
    side: String(event.side).toUpperCase() === 'S' ? 'SELL' : 'BUY',
    quantity: Number(event.filledQuantity ?? event.quantity ?? 0),
    price: Number(event.price ?? 0),
    status: String(event.status ?? 'UNKNOWN'),
    createdAt: event.inputTime,
    source: 'ssi',
    accountId,
  };
};
