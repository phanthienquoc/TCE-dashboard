'use client';

import axios from 'axios';
import { clearSession, getAccessToken } from './session';

let accessToken = '';
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || '';
}

function currentAccessToken() {
  if (accessToken) return accessToken;
  return getAccessToken();
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

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

function notifyAuthRefreshed(token) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tce:auth-refreshed', {
      detail: { accessToken: token },
    }));
  }
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tce:auth-expired'));
  }
}

api.interceptors.request.use((config) => attachAccessToken(config));

// The refresh token is an HttpOnly cookie. This function is intentionally the
// only path that establishes an access token after a full page reload.
export async function refreshAccessToken() {
  const { data } = await axios.post('/api/auth/refresh', null, {
    withCredentials: true,
    headers: { Accept: 'application/json' },
    timeout: 15000,
  });

  if (!data?.accessToken) {
    throw new Error('Refresh response missing access token');
  }

  setAccessToken(data.accessToken);
  notifyAuthRefreshed(data.accessToken);
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
      const token = await refreshPromise;
      attachAccessToken(original, token);
      return api(original);
    } catch (refreshError) {
      setAccessToken('');
      clearSession();
      notifyAuthExpired();
      if (original?._toastOnError !== false) {
        notifyApiError(refreshError, 'Session expired.');
      }
      throw refreshError;
    }
  },
);
