'use client';

import axios from 'axios';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

let refreshPromise = null;

function authHeaders(token = getAccessToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function attachAccessToken(config, token = getAccessToken()) {
  if (!token) return config;
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') config.headers.set('Authorization', `Bearer ${token}`);
  else config.headers.Authorization = `Bearer ${token}`;
  return config;
}

api.interceptors.request.use((config) => attachAccessToken(config));

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Session expired');
  const { data } = await axios.post('/api/auth/refresh', { refreshToken }, {
    withCredentials: true,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  if (!data?.accessToken) throw new Error('Refresh token response missing access token');
  saveSession(data);
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshRequest = original?.url?.includes('/auth/refresh');
    if (error.response?.status !== 401 || original?._retry || isRefreshRequest) throw error;
    original._retry = true;
    try {
      refreshPromise ||= refreshAccessToken().finally(() => { refreshPromise = null; });
      const accessToken = await refreshPromise;
      attachAccessToken(original, accessToken);
      return api(original);
    } catch (refreshError) {
      clearSession();
      throw refreshError;
    }
  },
);

// Login intentionally uses a clean Axios instance so stale auth state cannot
// interfere with the first Sign in request.
export async function login(email, password) {
  const { data } = await axios.post('/api/auth/login', { email, password }, {
    withCredentials: true,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get('/dashboard', {
    params: { _: Date.now() },
    headers: authHeaders(),
  });
  return data;
}

export async function getDashboardData() {
  const token = getAccessToken();
  const headers = authHeaders(token);
  const params = { _: Date.now() };

  // The aggregate endpoint is the source of truth and avoids a Promise.all
  // failure where one optional table makes the whole dashboard appear broken.
  try {
    const { data } = await api.get('/dashboard', { params, headers });
    return data;
  } catch (aggregateError) {
    if (aggregateError.response?.status === 401) throw aggregateError;

    // Keep the dashboard usable while diagnosing an individual endpoint.
    const entries = [
      ['account', '/dashboard/account', {}],
      ['positions', '/dashboard/positions', []],
      ['strategy', '/dashboard/strategy', null],
      ['pools', '/dashboard/pools', []],
      ['nextPositions', '/dashboard/next-positions', []],
      ['orders', '/dashboard/orders', []],
      ['sources', '/dashboard/sources', []],
    ];
    const results = await Promise.all(entries.map(async ([key, url, fallback]) => {
      try {
        const response = await api.get(url, { params, headers });
        return [key, response.data, null];
      } catch (error) {
        return [key, fallback, {
          status: error.response?.status ?? 0,
          message: error.response?.data?.message || error.message || 'request failed',
        }];
      }
    }));

    const result = Object.fromEntries(results.map(([key, value]) => [key, value]));
    const errors = Object.fromEntries(results.filter(([, , error]) => error).map(([key, , error]) => [key, error]));
    if (Object.keys(errors).length) result.errors = errors;
    if (!result.account || result.account === null) throw aggregateError;
    return result;
  }
}

export async function getBackendStatus() {
  const { data } = await api.get('/auth/status', {
    params: { _: Date.now() },
    headers: authHeaders(),
  });
  return data;
}
