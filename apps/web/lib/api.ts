import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { encryptCredentialPayload } from './credential-transport';

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';
export const api: AxiosInstance = axios.create({ baseURL, withCredentials: true, timeout: 15000 });
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(r => r, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  if (error.response?.status !== 401 || !config || config._retry || config.url?.includes('/auth/refresh') || config.url?.includes('/auth/login')) throw error;
  config._retry = true;
  refreshPromise ??= api.post<{accessToken:string}>('/auth/refresh').then(r => { setAccessToken(r.data.accessToken); return r.data.accessToken; }).catch(() => { setAccessToken(null); return null; }).finally(() => { refreshPromise = null; });
  const token = await refreshPromise;
  if (!token) throw error;
  config.headers.Authorization = `Bearer ${token}`;
  return api.request(config);
});

export const authApi = {
  status: () => api.get('/auth/status'),
  login: (email:string,password:string) => api.post('/auth/login',{email,password}),
  mfaLogin: (userId:string,code:string) => api.post('/auth/mfa/login',{userId,code}),
  recovery: (userId:string,code:string) => api.post('/auth/mfa/recovery',{userId,code}),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
};
export const dashboardApi = {
  all: (status?: string) => api.get('/dashboard', { params: status ? { status } : undefined }),
  account:()=>api.get('/dashboard/account'), positions:()=>api.get('/dashboard/positions'), orders:()=>api.get('/dashboard/orders'),
  pools:(status?: string)=>api.get('/dashboard/pools', { params: status ? { status } : undefined }),
  nextPositions:()=>api.get('/dashboard/next-positions'), strategy:()=>api.get('/dashboard/strategy'), sources:()=>api.get('/dashboard/sources'),
  engines:()=>api.get('/dashboard/engines'),
  setEngineStatus:(engineId:string,status:'ACTIVE'|'INACTIVE')=>api.patch(`/dashboard/engines/${engineId}/status`,{status}),
};
export const platformApi = {
  credentials:()=>api.get('/platform/credentials'), save:(provider:string,environment:string,credentials:Record<string,unknown>)=>api.post(`/platform/credentials/${provider}`,{environment,credentials}), remove:(provider:string,environment:string)=>api.delete(`/platform/credentials/${provider}`,{data:{environment}}),
  binanceTest:(environment:string)=>api.post('/platform/credentials/binance/test',{environment}), binanceOrder:(body:Record<string,unknown>)=>api.post('/platform/credentials/binance/order',body), binanceTp:(body:Record<string,unknown>)=>api.post('/platform/credentials/binance/tp',body), binanceSl:(body:Record<string,unknown>)=>api.post('/platform/credentials/binance/sl',body),
  ssiOtp:(body:Record<string,unknown>)=>api.post('/platform/credentials/ssi/request-otp',body), ssiTest:(body:Record<string,unknown>)=>api.post('/platform/credentials/ssi/test',body), ssiSaveTested:(body:Record<string,unknown>)=>api.post('/platform/credentials/ssi/save-tested',body), ssiSave:(environment:string,credentials:Record<string,unknown>)=>encryptCredentialPayload({ environment, credentials }).then(payload => api.post('/platform/credentials/ssi/save',payload)), ssiCurrent:(body:Record<string,unknown>)=>api.post('/platform/credentials/ssi/current',body), ssiSync:(body:Record<string,unknown>)=>api.post('/platform/credentials/ssi/sync',body), ssiMarketPriceSync:()=>api.post('/platform/credentials/ssi/sync-market-price'),
  fastApiConfig:()=>api.get('/platform/config/fastapi'), saveFastApi:(body:Record<string,string>)=>api.post('/platform/config/fastapi',body)
};
