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
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

    if (error.response?.status !== 401 || original?._retry || isRefreshRequest) {
      throw error;
    }

    original._retry = true;

    try {
      refreshPromise ||= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const accessToken = await refreshPromise;
      attachAccessToken(original, accessToken);
      return api(original);
    } catch (refreshError) {
      clearSession();
      throw refreshError;
    }
  },
);

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function getDashboard() {
  const token = getAccessToken();
  const { data } = await api.get('/dashboard', {
    params: { _: Date.now() },
    headers: authHeaders(token),
  });
  return data;
}

export async function getBackendStatus() {
  const token = getAccessToken();
  const { data } = await api.get('/auth/status', {
    params: { _: Date.now() },
    headers: authHeaders(token),
  });
  return data;
}

export async function createPosition(payload) {
  const { data } = await api.post('/dashboard/positions', payload, {
    headers: authHeaders(),
  });
  return data;
}

export async function createOrder(payload) {
  const { data } = await api.post('/dashboard/orders', payload, {
    headers: authHeaders(),
  });
  return data;
}
