export const getAccessToken = () => localStorage.getItem('tce_access_token') || '';
export const getRefreshToken = () => localStorage.getItem('tce_refresh_token') || '';

export function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
  localStorage.setItem('tce_access_token', session.accessToken);
  if (session.refreshToken) localStorage.setItem('tce_refresh_token', session.refreshToken);
}

export function clearSession() {
  localStorage.removeItem('tce_access_token');
  localStorage.removeItem('tce_refresh_token');
  localStorage.removeItem('tce_mfa_user_id');
}

export function hasSession() {
  return Boolean(getAccessToken());
}
