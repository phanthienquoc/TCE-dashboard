import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { encryptCredentialPayload } from './credential-transport';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
export const api: AxiosInstance = axios.create({ baseURL, withCredentials: true, timeout: 15000 });
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retry ||
      config.url?.includes('/auth/refresh') ||
      config.url?.includes('/auth/login')
    )
      throw error;
    config._retry = true;
    refreshPromise ??= api
      .post<{ accessToken: string }>('/auth/refresh')
      .then(r => {
        setAccessToken(r.data.accessToken);
        return r.data.accessToken;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
    const token = await refreshPromise;
    if (!token) throw error;
    config.headers.Authorization = `Bearer ${token}`;
    return api.request(config);
  }
);
export const authApi = {
  status: () => api.get('/auth/status'),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  mfaLogin: (userId: string, code: string) => api.post('/auth/mfa/login', { userId, code }),
  recovery: (userId: string, code: string) => api.post('/auth/mfa/recovery', { userId, code }),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
};
export const dashboardApi = {
  all: (status?: string) => api.get('/dashboard', { params: status ? { status } : undefined }),
  account: () => api.get('/dashboard/account'),
  positions: () => api.get('/dashboard/positions'),
  orders: () => api.get('/dashboard/orders'),
  pools: (status?: string) =>
    api.get('/dashboard/pools', { params: status ? { status } : undefined }),
  nextPositions: () => api.get('/dashboard/next-positions'),
  promotePool: (poolEntryId: string, body?: { entry?: number; quantity?: number }) =>
    api.post(`/dashboard/pools/${encodeURIComponent(poolEntryId)}/promote`, body ?? {}),
  strategy: () => api.get('/dashboard/strategy'),
  sources: () => api.get('/dashboard/sources'),
  engines: () => api.get('/dashboard/engines'),
  setEngineStatus: (engineId: string, status: 'ACTIVE' | 'INACTIVE') =>
    api.patch(`/dashboard/engines/${engineId}/status`, { status }),
  engineConfig: () => api.get('/dashboard/engine-config'),
  setEngineConfig: (config: Record<string, unknown>) =>
    api.patch('/dashboard/engine-config', { config }),
};
export const platformApi = {
  credentials: () => api.get('/platform/credentials'),
  save: (provider: string, environment: string, credentials: Record<string, unknown>) =>
    api.post(`/platform/credentials/${provider}`, { environment, credentials }),
  remove: (provider: string, environment: string) =>
    api.delete(`/platform/credentials/${provider}`, { data: { environment } }),
  binanceTest: (environment: string) =>
    api.post('/platform/credentials/binance/test', { environment }),
  binanceOrder: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/binance/order', body),
  binanceTp: (body: Record<string, unknown>) => api.post('/platform/credentials/binance/tp', body),
  binanceSl: (body: Record<string, unknown>) => api.post('/platform/credentials/binance/sl', body),
  binanceClose: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/binance/close', body),
  telegramBots: () => api.get('/platform/telegram/bots'),
  telegramSave: (body: { token: string; chatId?: string; environment?: string; name?: string }) =>
    api.post('/platform/telegram/save', body),
  telegramTest: (token: string) => api.post('/platform/telegram/test', { token }),
  telegramRemove: (body: { environment?: string; name?: string }) =>
    api.delete('/platform/telegram', { data: body }),
  telegramDebugAssignments: () => api.get('/platform/telegram/debug/assignments'),
  telegramAssignDebug: (body: {
    telegramCredentialId: string;
    serviceName: string;
    minLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    enabled?: boolean;
  }) => api.post('/platform/telegram/debug/assignments', body),
  telegramUnassignDebug: (id: string) => api.delete(`/platform/telegram/debug/assignments/${id}`),
  ssiOtp: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/ssi/request-otp', body),
  ssiApprove: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/ssi/approve', body),
  ssiTest: (body: Record<string, unknown>) => api.post('/platform/credentials/ssi/test', body),
  ssiSaveTested: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/ssi/save-tested', body),
  ssiSave: (environment: string, credentials: Record<string, unknown>) =>
    encryptCredentialPayload({ environment, credentials }).then(payload =>
      api.post('/platform/credentials/ssi/save', payload)
    ),
  ssiCurrent: (body: Record<string, unknown>) =>
    api.post('/platform/credentials/ssi/current', body),
  ssiSync: (body: Record<string, unknown>) => api.post('/platform/credentials/ssi/sync', body),
  ssiMarketPriceSync: () => api.post('/platform/credentials/ssi/sync-market-price'),
  ssiOrder: (body: {
    environment?: string;
    accountNo?: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'LO' | 'MTL' | 'MP' | 'ATO' | 'ATC' | 'MOK' | 'MAK' | 'PLO';
    price?: number;
    clientRequestId?: string;
  }) => api.post('/platform/credentials/ssi/order', body),
  fastApiConfig: () => api.get('/platform/config/fastapi'),
  saveFastApi: (body: Record<string, string>) => api.post('/platform/config/fastapi', body),
  binanceXauConfig: () => api.get('/tce/engine/binance/config'),
  saveBinanceXauConfig: (body: Record<string, unknown>) => api.patch('/tce/engine/binance/config', body),
  binanceXauPositions: (environment = 'production') =>
    api.get('/tce/engine/binance/positions', { headers: { 'x-environment': environment } }),
  binanceXauOrders: (environment = 'production') =>
    api.get('/tce/engine/binance/orders', { headers: { 'x-environment': environment } }),
};
