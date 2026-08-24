export const ACCESS_TOKEN = 'tce_access_token';
export const REFRESH_TOKEN = 'tce_refresh_token';

export function getAccessToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACCESS_TOKEN) || '';
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REFRESH_TOKEN) || '';
}

export function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
  localStorage.setItem(ACCESS_TOKEN, session.accessToken);
  if (session.refreshToken) localStorage.setItem(REFRESH_TOKEN, session.refreshToken);
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN);
  localStorage.removeItem(REFRESH_TOKEN);
  localStorage.removeItem('tce_mfa_user_id');
}
