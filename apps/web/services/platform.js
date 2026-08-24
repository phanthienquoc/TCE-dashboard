'use client';

import { api } from '../lib/api';

const credentialsPath = '/platform/credentials';

export async function hasSsiCredentials() {
  const { data } = await api.get(credentialsPath);
  return Array.isArray(data) && data.some((item) => item.provider === 'ssi');
}

export async function saveSsiCredentials(environment, credentials) {
  await api.post(`${credentialsPath}/ssi`, {
    environment,
    credentials,
  });
}

export async function requestSsiOtp(environment) {
  const { data } = await api.post(`${credentialsPath}/ssi/request-otp`, {
    environment,
  });
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
