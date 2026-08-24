export const ACCESS_TOKEN = 'tce_access_token';
export const REFRESH_TOKEN = 'tce_refresh_token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function removeCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

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
    // Cookie fallback keeps the session usable when Web Storage is unavailable.
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures; cookie cleanup below is authoritative fallback.
  }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return '';
  return readStorage(ACCESS_TOKEN) || getCookie(ACCESS_TOKEN);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return '';
  return readStorage(REFRESH_TOKEN) || getCookie(REFRESH_TOKEN);
}

export function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
  writeStorage(ACCESS_TOKEN, session.accessToken);
  setCookie(ACCESS_TOKEN, session.accessToken);
  if (session.refreshToken) {
    writeStorage(REFRESH_TOKEN, session.refreshToken);
    setCookie(REFRESH_TOKEN, session.refreshToken);
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  removeStorage(ACCESS_TOKEN);
  removeStorage(REFRESH_TOKEN);
  removeStorage('tce_mfa_user_id');
  removeCookie(ACCESS_TOKEN);
  removeCookie(REFRESH_TOKEN);
  removeCookie('tce_mfa_user_id');
}
