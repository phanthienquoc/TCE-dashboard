'use client';

import axios from 'axios';
import { api } from '../lib/api';

// Login must bypass the authenticated Axios client. The shared client has a
// 401 -> refresh interceptor, which can race the first credential request when
// the page still has a stale session. A clean client guarantees the first
// click always reaches POST /api/auth/login directly.
export async function login(email, password) {
  const { data } = await axios.post('/api/auth/login', { email, password }, {
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get('/auth/me', {
    _toastOnError: false,
  });
  return data?.user || data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout', null, {
    _toastOnError: false,
  });
  return data;
}

export async function getBackendStatus() {
  const { data } = await api.get('/auth/status', {
    params: { _: Date.now() },
  });
  return data;
}
