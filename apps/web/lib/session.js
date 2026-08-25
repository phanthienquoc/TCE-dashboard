export const ACCESS_TOKEN = 'tce_access_token';
export const REFRESH_TOKEN = 'tce_refresh_token';

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

// Access tokens intentionally live only in memory. The backend persists the
// refresh session in an HttpOnly cookie, so a full page reload can establish a
// fresh access token without exposing long-lived credentials to JavaScript.
export function getAccessToken() {
  return '';
}

// Kept for API compatibility. Refresh tokens are HttpOnly and never readable
// from client-side JavaScript.
export function getRefreshToken() {
  return '';
}

export function saveSession(session) {
  if (!session?.accessToken) throw new Error('No access token returned');
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  // Remove legacy client-side tokens from older builds during migration.
  removeStorage(ACCESS_TOKEN);
  removeStorage(REFRESH_TOKEN);
  removeStorage('tce_mfa_user_id');
}
