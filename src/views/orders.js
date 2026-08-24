import { money, num } from '../lib/format.js';

export function ordersView(data) {
  return `<section class="section page-section"><div class="section-head"><div><h2>Recent orders</h2><small>Your account only • full TCE fields</small></div><div class="section-tools"><span>${data.orders.length}</span><button type="button" class="section-add" data-entry-open="order">＋ Order</button></div></div><div class="orders">${data.orders.length ? data.orders.map((order) => `<div class="order"><span class="badge ${order.side === 'BUY' ? 'buy' : 'sell'}">${order.side}</span><b>${order.symbol}</b><span>${order.quantity} × ${num(order.price)}</span><strong>${money(order.gross_value)}</strong><small>${order.order_date || ''} • fee ${money(order.fee_tax || 0)} • net ${money(order.net_cashflow || 0)}</small></div>`).join('') : '<div class="empty">No recent orders</div>'}</div></section>`;
}
