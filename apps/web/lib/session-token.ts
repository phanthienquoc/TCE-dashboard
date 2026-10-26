let accessToken: string | null = null;

/** Keep short-lived access tokens in memory only; refresh credentials stay HttpOnly. */
export function setAccessToken(value: string | null): void {
  accessToken = value;
}

export function getAccessToken(): string | null {
  return accessToken;
}
