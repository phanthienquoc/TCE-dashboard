'use client';

import axios from 'axios';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';

let authTokenProvider = null;
let authSessionListener = null;

export function setAuthTokenProvider(provider) {
  authTokenProvider = provider;
}

export function setAuthSessionListener(listener) {
  authSessionListener = listener;
}

function currentAccessToken() {
  return authTokenProvider?.() || getAccessToken();
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

let refreshPromise = null;

function attachAccessToken(config, token = currentAccessToken()) {
  if (!token) return config;
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

export function notifyApiError(error, fallback = 'API request failed.') {
  if (typeof window === 'undefined') return;
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;
  const message = serverMessage || error?.message || fallback;
  const prefix = status ? `API ${status}` : 'API';
  window.dispatchEvent(new CustomEvent('tce:toast', {
    detail: { type: 'error', message: `${prefix}: ${message}` },
  }));
}

api.interceptors.request.use((config) => attachAccessToken(config));

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Session expired');

  const { data } = await axios.post('/api/auth/refresh', { refreshToken }, {
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  if (!data?.accessToken) {
    throw new Error('Refresh token response missing access token');
  }

  saveSession(data);
  authSessionListener?.(data);
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshRequest = original?.url?.includes('/auth/refresh');

    if (error.response?.status !== 401 || original?._retry || isRefreshRequest) {
      if (original?._toastOnError !== false) notifyApiError(error);
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
      authSessionListener?.(null);
      if (original?._toastOnError !== false) {
        notifyApiError(refreshError, 'Session expired.');
      }
      throw refreshError;
    }
  },
);
