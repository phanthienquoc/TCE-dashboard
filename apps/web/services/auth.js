'use client';

import { api } from '../lib/api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
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
