import { todayLocal } from '../lib/format.js';
import { loadDashboard, saveDashboardEntry } from '../lib/api/dashboard.js';
import { clearSession } from '../lib/session.js';

export function entryModal() {
  return `<div id="entry-modal" class="entry-modal" aria-hidden="true"><div class="entry-backdrop" data-entry-close></div><section class="entry-sheet" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div class="entry-head"><div><span class="eyebrow">TCE • MANUAL ENTRY</span><h2 id="entry-title">Add position</h2></div><button class="entry-close" type="button" data-entry-close>×</button></div><div class="entry-tabs"><button type="button" class="active" data-entry-tab="position">Position</button><button type="button" data-entry-tab="order">Order</button></div><form id="position-form" class="entry-form" data-entry-form="position"><div class="entry-grid"><label>Symbol<input name="symbol" type="text" maxlength="16" placeholder="PTB" required></label><label>Quantity<input name="quantity" type="number" min="1" step="1" placeholder="300" required></label><label>Avg cost<input name="avg_cost" type="number" min="0" step="0.01" placeholder="32000" required></label><label>Cost basis<input name="cost_basis" type="number" min="0" step="1" placeholder="Auto" readonly></label><label>Market price<input name="market_price" type="number" min="0" step="0.01" placeholder="32000"></label><label>Market value<input name="market_value" type="number" min="0" step="1" placeholder="Auto" readonly></label><label>Unrealized P/L<input name="unrealized_pnl" type="number" step="1" placeholder="Auto" readonly></label><label>Status<select name="status"><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option></select></label><label>Cycle no.<input name="cycle_no" type="number" step="1" value="0"></label></div><p class="entry-hint">Account ID, position ID, timestamps and derived values are handled by TCE. Saving the same symbol updates the current position.</p><div class="entry-actions"><button type="button" class="secondary" data-entry-close>Cancel</button><button type="submit" class="primary">Save position</button></div><div class="entry-error" data-entry-error></div></form><form id="order-form" class="entry-form hidden" data-entry-form="order"><div class="entry-grid"><label>Order date<input name="order_date" type="date" value="${todayLocal()}" required></label><label>Symbol<input name="symbol" type="text" maxlength="16" placeholder="PTB" required></label><label>Side<select name="side"><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label><label>Price<input name="price" type="number" min="0" step="0.01" placeholder="32000" required></label><label>Quantity<input name="quantity" type="number" min="1" step="1" placeholder="300" required></label><label>Gross value<input name="gross_value" type="number" min="0" step="1" placeholder="Auto" readonly></label><label>Fee + tax<input name="fee_tax" type="number" min="0" step="1" value="0"></label><label>Net cashflow<input name="net_cashflow" type="number" step="1" placeholder="Auto" readonly></label><label>Cycle no.<input name="cycle_no" type="number" step="1" value="0"></label><label>Status<select name="status"><option value="EXECUTED">EXECUTED</option><option value="PENDING">PENDING</option><option value="CANCELLED">CANCELLED</option></select></label><label class="full">Note<textarea name="note" rows="3" placeholder="Manual entry / broker note..."></textarea></label></div><p class="entry-hint">Gross value and net cashflow are calculated from price × quantity, side and fee/tax. Account ID, order ID and created time are handled by TCE.</p><div class="entry-actions"><button type="button" class="secondary" data-entry-close>Cancel</button><button type="submit" class="primary">Save order</button></div><div class="entry-error" data-entry-error></div></form></section></div>`;
}

function setEntryTab(kind) {
  document.querySelectorAll('[data-entry-tab]').forEach((button) => button.classList.toggle('active', button.dataset.entryTab === kind));
  document.querySelectorAll('[data-entry-form]').forEach((form) => form.classList.toggle('hidden', form.dataset.entryForm !== kind));
  const title = document.querySelector('#entry-title');
  if (title) title.textContent = kind === 'position' ? 'Add position' : 'Add order';
}

function openEntry(kind = 'position') {
  const modal = document.querySelector('#entry-modal');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setEntryTab(kind);
  document.body.classList.add('modal-open');
  setTimeout(() => modal.querySelector(`[data-entry-form="${kind}"] input`)?.focus(), 50);
}

function closeEntry() {
  const modal = document.querySelector('#entry-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function recalcEntry() {
  const positionForm = document.querySelector('#position-form');
  if (positionForm) {
    const quantity = Number(positionForm.elements.quantity.value || 0);
    const avgCost = Number(positionForm.elements.avg_cost.value || 0);
    const marketPrice = positionForm.elements.market_price.value === '' ? null : Number(positionForm.elements.market_price.value);
    positionForm.elements.cost_basis.value = quantity && avgCost ? quantity * avgCost : '';
    positionForm.elements.market_value.value = marketPrice == null ? '' : quantity * marketPrice;
    positionForm.elements.unrealized_pnl.value = marketPrice == null || !quantity ? '' : quantity * marketPrice - quantity * avgCost;
  }

  const orderForm = document.querySelector('#order-form');
  if (orderForm) {
    const quantity = Number(orderForm.elements.quantity.value || 0);
    const price = Number(orderForm.elements.price.value || 0);
    const fee = Number(orderForm.elements.fee_tax.value || 0);
    const gross = quantity * price;
    orderForm.elements.gross_value.value = gross || '';
    orderForm.elements.net_cashflow.value = gross ? (orderForm.elements.side.value === 'BUY' ? -(gross + fee) : gross - fee) : '';
  }
}

function normalizePayload(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  for (const key of ['quantity', 'avg_cost', 'cost_basis', 'market_price', 'market_value', 'unrealized_pnl', 'cycle_no', 'price', 'gross_value', 'fee_tax', 'net_cashflow']) {
    if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]);
  }
  if (payload.market_price === '') payload.market_price = null;
  if (payload.note === '') payload.note = null;
  return payload;
}

async function submitEntry(form) {
  const kind = form.dataset.entryForm;
  const errorBox = form.querySelector('[data-entry-error]');
  const button = form.querySelector('button[type="submit"]');
  errorBox.textContent = '';
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    await saveDashboardEntry(kind, normalizePayload(form));
    closeEntry();
    window.__tceData = await loadDashboard();
    await window.__tceRender(window.__tceData);
  } catch (error) {
    errorBox.textContent = error.message || 'Unable to save';
    if (error.message === 'Session expired') {
      clearSession();
      history.replaceState({}, '', '/login');
      await window.__tceRender();
    }
  } finally {
    button.disabled = false;
    button.textContent = kind === 'position' ? 'Save position' : 'Save order';
  }
}

function entryKeyHandler(event) {
  if (event.key === 'Escape' && document.querySelector('#entry-modal.open')) closeEntry();
}

export function bindEntryModal() {
  document.querySelectorAll('[data-entry-close]').forEach((element) => element.addEventListener('click', closeEntry));
  document.querySelectorAll('[data-entry-tab]').forEach((element) => element.addEventListener('click', () => setEntryTab(element.dataset.entryTab)));
  document.querySelectorAll('[data-entry-open]').forEach((element) => element.addEventListener('click', () => openEntry(element.dataset.entryOpen)));
  document.querySelectorAll('.entry-form').forEach((form) => {
    form.addEventListener('input', recalcEntry);
    form.addEventListener('change', recalcEntry);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitEntry(form);
    });
  });
  document.addEventListener('keydown', entryKeyHandler);
  recalcEntry();
}
