'use client';

import { api } from '../lib/api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function getBackendStatus() {
  const { data } = await api.get('/auth/status', {
    params: { _: Date.now() },
  });
  return data;
}
