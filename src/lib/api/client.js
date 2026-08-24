import axios from 'axios';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from '../session.js';

const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry || original?.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken }, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      saveSession(data);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  },
);

export function apiErrorMessage(error, fallback = 'Request failed') {
  return error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback;
}

export default api;
