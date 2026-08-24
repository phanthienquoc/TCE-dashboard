import api, { apiErrorMessage } from './client.js';
import { clearSession } from '../session.js';

export const fallbackDashboard = {
  account: {
    initial_capital: 0,
    cashout_realized: 0,
    capital_deployed: 0,
    capital_available: 0,
    recovery_remaining: 0,
    current_cycle: 1,
  },
  positions: [],
  orders: [],
  pools: [],
  nextPositions: [],
  candidates: [],
};

export async function checkBackend() {
  try {
    const { data } = await api.get('/auth/status', { headers: { 'Cache-Control': 'no-cache' } });
    return { ok: data?.configured !== false, checking: false, ...data };
  } catch (error) {
    return { ok: false, checking: false, error: apiErrorMessage(error, 'Backend unavailable') };
  }
}

export async function loadDashboard() {
  try {
    const { data } = await api.get('/dashboard', { headers: { 'Cache-Control': 'no-cache' } });
    return data;
  } catch (error) {
    if (error?.response?.status === 401) {
      clearSession();
      throw new Error('Session expired');
    }
    throw new Error(apiErrorMessage(error, 'Dashboard unavailable'));
  }
}

export async function saveDashboardEntry(kind, payload) {
  try {
    const endpoint = kind === 'position' ? '/dashboard/positions' : '/dashboard/orders';
    const { data } = await api.post(endpoint, payload);
    return data;
  } catch (error) {
    if (error?.response?.status === 401) {
      clearSession();
      throw new Error('Session expired');
    }
    throw new Error(apiErrorMessage(error, `Unable to save ${kind}`));
  }
}
