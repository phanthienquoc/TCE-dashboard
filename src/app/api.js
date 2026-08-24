import { api } from './http.js';

export async function checkBackend() {
  try {
    const { data } = await api.get('/auth/status', { headers: { 'Cache-Control': 'no-cache' } });
    return { ok: data?.configured !== false, checking: false, ...data };
  } catch (error) {
    return { ok: false, checking: false, error: error?.message || 'Backend unavailable' };
  }
}

export async function loadDashboard() {
  const { data } = await api.get('/dashboard');
  return data;
}

export async function saveEntry(kind, payload) {
  const resource = kind === 'position' ? 'positions' : 'orders';
  const { data } = await api.post(`/dashboard/${resource}`, payload);
  return data;
}
