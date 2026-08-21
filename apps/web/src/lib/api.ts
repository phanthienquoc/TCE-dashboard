const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(await response.text() || `API ${response.status}`);
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) => api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (refreshToken: string) => api('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  mfaLogin: (userId: string, code: string) => api('/auth/mfa/login', { method: 'POST', body: JSON.stringify({ userId, code }) }),
  recovery: (userId: string, code: string) => api('/auth/mfa/recovery', { method: 'POST', body: JSON.stringify({ userId, code }) }),
};
