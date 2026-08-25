'use client';

import axios from 'axios';
import { clearSession } from './session';

// Access tokens are deliberately memory-only. The refresh session lives in
// the backend-issued HttpOnly cookie and is never readable by JavaScript.
let accessToken = '';
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || '';
}

function currentAccessToken() {
  return accessToken;
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

async function postRefresh(url) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    redirect: 'manual',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: null,
  });

  // Some outer reverse proxies incorrectly answer POST requests with a
  // 301/302/303. Browsers then transparently replay the Location as GET,
  // producing the exact "Cannot GET /api/auth/refresh" 404 seen in Safari.
  // Follow the redirect explicitly while keeping the method POST.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error(`Refresh redirect missing Location (${response.status})`);

    const target = new URL(location, window.location.origin).toString();
    const redirected = await fetch(target, {
      method: 'POST',
      credentials: 'include',
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: null,
    });

    if (redirected.status >= 300 && redirected.status < 400) {
      throw new Error(`Refresh endpoint redirected repeatedly (${redirected.status})`);
    }

    if (!redirected.ok) {
      const message = await redirected.text().catch(() => '');
      throw new Error(message || `Refresh failed with HTTP ${redirected.status}`);
    }

    return redirected.json();
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Refresh failed with HTTP ${response.status}`);
  }

  return response.json();
}

// The browser sends the HttpOnly refresh cookie automatically. This is the
// only code path that creates an access token after a full page reload.
export async function refreshAccessToken() {
  const data = await postRefresh('/api/auth/refresh');

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
