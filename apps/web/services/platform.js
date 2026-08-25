'use client';

import { api } from '../lib/api';

const credentialsPath = '/platform/credentials';

export async function listPlatformCredentials() { const { data } = await api.get(credentialsPath); return Array.isArray(data) ? data : []; }
export async function hasPlatformCredentials(provider, environment = 'production') { const data = await listPlatformCredentials(); return data.some((item) => item.provider === provider && item.environment === environment && item.isActive !== false); }
export async function hasSsiCredentials(environment = 'production') { return hasPlatformCredentials('ssi', environment); }
export async function hasBinanceCredentials(environment = 'production') { return hasPlatformCredentials('binance', environment); }
export async function saveSsiCredentials(environment, credentials) { await api.post(`${credentialsPath}/ssi`, { environment, credentials }); }
export async function saveBinanceCredentials(environment, credentials) { await api.post(`${credentialsPath}/binance`, { environment, credentials }); }
export async function requestSsiOtp(payload) { const { data } = await api.post(`${credentialsPath}/ssi/request-otp`, payload); return data; }
export async function testSsiConnection(payload) { const { data } = await api.post(`${credentialsPath}/ssi/test`, payload); return data?.data || data; }
export async function getCurrentSsiInfo(payload) { const { data } = await api.post(`${credentialsPath}/ssi/current`, payload); return data?.data || data; }
export async function syncSsiPortfolio(payload) { const { data } = await api.post(`${credentialsPath}/ssi/sync`, payload); return data?.data || data; }
export async function testBinanceConnection(environment = 'production') { const { data } = await api.post(`${credentialsPath}/binance/test`, { environment }); return data?.data || data; }
export async function placeBinanceOrder(payload) { const { data } = await api.post(`${credentialsPath}/binance/order`, payload); return data?.data || data; }
export async function placeBinanceTp(payload) { const { data } = await api.post(`${credentialsPath}/binance/tp`, payload); return data?.data || data; }
export async function placeBinanceSl(payload) { const { data } = await api.post(`${credentialsPath}/binance/sl`, payload); return data?.data || data; }
