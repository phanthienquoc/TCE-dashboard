import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tce_access_token') || '';
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tce_access_token');
      localStorage.removeItem('tce_refresh_token');
      error.isSessionExpired = true;
    }
    return Promise.reject(error);
  },
);

export default api;
