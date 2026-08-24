import { money, num } from '../lib/format.js';

export function positionActions(position) {
  const id = String(position.id || position.symbol).replace(/[^a-zA-Z0-9_-]/g, '');
  return `<div class="position-actions" data-position-id="${id}"><button data-position-action="HOLD">Hold</button><button data-position-action="TAKE_PROFIT">Take profit</button><button data-position-action="CUT">Cut</button><button data-position-action="CASHOUT">Cash out</button></div>`;
}

export function bindPositionActions() {
  document.querySelectorAll('[data-position-action]').forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('.position-wrap');
    const status = row?.querySelector('.position-action-status');
    if (status) {
      status.textContent = `Action selected: ${button.dataset.positionAction.replace('_', ' ')}`;
      status.className = 'position-action-status selected';
    }
    row?.classList.toggle('expanded', false);
  }));
}

export function positionsView(data) {
  const candidates = data.nextPositions || data.candidates || [];
  return `<section class="section page-section"><div class="section-head"><div><h2>Positions</h2><small>Your portfolio • manual entry supported</small></div><div class="section-tools"><span>${data.positions.length}</span><button type="button" class="section-add" data-entry-open="position">＋ Position</button></div></div><div class="cards">${data.positions.length ? data.positions.map((position) => `<div class="position-wrap"><div class="position"><div><b>${position.symbol}</b><small>${position.quantity} cp • avg ${num(position.avg_cost)} • cycle ${position.cycle_no ?? 0}</small></div><div class="right"><b>${money(position.market_value || position.cost_basis)}</b><small class="${(position.unrealized_pnl || 0) >= 0 ? 'up' : 'down'}">${(position.unrealized_pnl || 0) >= 0 ? '+' : ''}${money(position.unrealized_pnl || 0)}</small></div><button class="position-more" aria-label="Position actions" data-position-toggle>⋯</button></div><div class="position-actions-panel">${positionActions(position)}<span class="position-action-status">Choose an action</span></div></div>`).join('') : '<div class="empty">No open positions</div>'}</div></section><section class="section planned"><div class="section-head"><div><h2>Next 5 positions</h2><small>Shared buying candidates</small></div><span>${candidates.length}/5</span></div><div class="planned-list">${Array.from({ length: 5 }, (_, index) => candidates[index]).map((candidate, index) => candidate ? `<div class="planned-row"><span class="slot">${candidate.rank}</span><div><b>${candidate.symbol}</b><small>${candidate.target_quantity ? `${num(candidate.target_quantity)} cp` : ''}${candidate.target_price ? ` • target ${num(candidate.target_price)}` : ''}${candidate.reason ? ` • ${candidate.reason}` : ''}</small></div><span class="planned-status">${candidate.status}</span></div>` : `<div class="planned-row"><span class="slot">${index + 1}</span><div><b>Position ${index + 1}</b><small>Waiting for shared candidate feed</small></div><span class="planned-status">Available</span></div>`).join('')}</div></section>`;
}
