'use client';

import axios from 'axios';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/refresh')) {
      throw error;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      throw new Error('Session expired');
    }

    original._retry = true;
    refreshPromise ||= axios.post('/api/auth/refresh', { refreshToken }, { headers: { Accept: 'application/json' } })
      .then(({ data }) => {
        saveSession(data);
        return data.accessToken;
      })
      .catch((refreshError) => {
        clearSession();
        throw refreshError;
      })
      .finally(() => { refreshPromise = null; });

    const accessToken = await refreshPromise;
    original.headers = { ...(original.headers || {}), Authorization: `Bearer ${accessToken}` };
    return api(original);
  },
);

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function getDashboard() {
  const { data } = await api.get('/dashboard', { params: { _: Date.now() } });
  return data;
}

export async function getBackendStatus() {
  const { data } = await api.get('/auth/status', { params: { _: Date.now() } });
  return data;
}

export async function createPosition(payload) {
  const { data } = await api.post('/dashboard/positions', payload);
  return data;
}

export async function createOrder(payload) {
  const { data } = await api.post('/dashboard/orders', payload);
  return data;
}
