'use client';

import { api } from '../lib/api';

const credentialsPath = '/platform/credentials';

export async function listPlatformCredentials() {
  const { data } = await api.get(credentialsPath);
  return Array.isArray(data) ? data : [];
}

export async function hasSsiCredentials(environment = 'production') {
  const data = await listPlatformCredentials();
  return data.some((item) => item.provider === 'ssi' && item.environment === environment && item.isActive !== false);
}

export async function saveSsiCredentials(environment, credentials) {
  await api.post(`${credentialsPath}/ssi`, { environment, credentials });
}

export async function requestSsiOtp(payload) {
  const { data } = await api.post(`${credentialsPath}/ssi/request-otp`, payload);
  return data;
}

export async function testSsiConnection(payload) {
  const { data } = await api.post(`${credentialsPath}/ssi/test`, payload);
  return data?.data || data;
}

export async function getCurrentSsiInfo(payload) {
  const { data } = await api.post(`${credentialsPath}/ssi/current`, payload);
  return data?.data || data;
}

export async function syncSsiPortfolio(payload) {
  const { data } = await api.post(`${credentialsPath}/ssi/sync`, payload);
  return data?.data || data;
}
