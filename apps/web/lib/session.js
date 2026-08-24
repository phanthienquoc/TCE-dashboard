export const ACCESS_TOKEN = 'tce_access_token';
export const REFRESH_TOKEN = 'tce_refresh_token';

function readStorage(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    throw new Error('Unable to access localStorage');
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return '';
  return readStorage(ACCESS_TOKEN);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return '';
  return readStorage(REFRESH_TOKEN);
}

export function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
  writeStorage(ACCESS_TOKEN, session.accessToken);
  if (session.refreshToken) writeStorage(REFRESH_TOKEN, session.refreshToken);
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  removeStorage(ACCESS_TOKEN);
  removeStorage(REFRESH_TOKEN);
  removeStorage('tce_mfa_user_id');
}
