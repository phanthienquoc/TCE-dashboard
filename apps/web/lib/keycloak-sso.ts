const STATE_KEY = 'tce_oidc_state';
const NONCE_KEY = 'tce_oidc_nonce';
const VERIFIER_KEY = 'tce_oidc_verifier';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing public Keycloak configuration: ${name}`);
  return value;
}

function config() {
  const baseUrl = required('NEXT_PUBLIC_KEYCLOAK_URL', process.env.NEXT_PUBLIC_KEYCLOAK_URL).replace(/\/+$/, '');
  const realm = required('NEXT_PUBLIC_KEYCLOAK_REALM', process.env.NEXT_PUBLIC_KEYCLOAK_REALM);
  const clientId = required('NEXT_PUBLIC_KEYCLOAK_CLIENT_ID', process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID);
  const authBaseUrl = required('NEXT_PUBLIC_AUTH_BASE_URL', process.env.NEXT_PUBLIC_AUTH_BASE_URL).replace(/\/+$/, '');
  return {
    baseUrl,
    realm,
    clientId,
    authBaseUrl,
    issuer: `${baseUrl}/realms/${realm}`,
    redirectUri: `${window.location.origin}/auth/callback`,
  };
}

export function keycloakSsoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === 'keycloak' &&
    Boolean(
      process.env.NEXT_PUBLIC_KEYCLOAK_URL &&
      process.env.NEXT_PUBLIC_KEYCLOAK_REALM &&
      process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID &&
      process.env.NEXT_PUBLIC_AUTH_BASE_URL
    );
}

function randomUrlSafe(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    character => character.charCodeAt(0)
  );
}

function decodeJwtPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>;
}

async function verifyIdToken(token: string, cfg: ReturnType<typeof config>, expectedNonce: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid identity token returned by Keycloak');
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Unsupported Keycloak identity-token signing algorithm');
  }

  const jwksResponse = await fetch(`${cfg.issuer}/protocol/openid-connect/certs`, {
    cache: 'no-store',
  });
  if (!jwksResponse.ok) throw new Error('Unable to verify the Keycloak identity token');
  const jwks = await jwksResponse.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
  const key = jwks.keys?.find(candidate =>
    candidate.kid === header.kid && candidate.kty === 'RSA' &&
    (!candidate.alg || candidate.alg === 'RS256') && (!candidate.use || candidate.use === 'sig')
  );
  if (!key) throw new Error('Unable to verify the Keycloak identity token');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  const audience = claims.aud;
  const audienceMatches = audience === cfg.clientId ||
    (Array.isArray(audience) && audience.includes(cfg.clientId));
  const now = Math.floor(Date.now() / 1000);
  if (
    !validSignature ||
    claims.iss !== cfg.issuer ||
    !audienceMatches ||
    (Array.isArray(audience) && audience.length > 1 && claims.azp !== cfg.clientId) ||
    (typeof claims.azp === 'string' && claims.azp !== cfg.clientId) ||
    claims.nonce !== expectedNonce ||
    typeof claims.sub !== 'string' ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    typeof claims.iat !== 'number' || claims.iat > now + 60
  ) {
    throw new Error('Keycloak identity-token validation failed');
  }
}

export async function beginKeycloakLogin(): Promise<void> {
  if (!keycloakSsoEnabled()) throw new Error('Keycloak SSO is not enabled for this deployment');
  const cfg = config();
  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFor(verifier);
  const authorize = new URL(`${cfg.issuer}/protocol/openid-connect/auth`);
  authorize.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  window.location.assign(authorize.toString());
}

/** Complete Authorization Code + PKCE and exchange the verified identity for the existing app session. */
export async function completeKeycloakLogin(search: string): Promise<string> {
  const cfg = config();
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const clearTransaction = () => {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  };

  if (params.has('error')) {
    clearTransaction();
    throw new Error('Keycloak sign-in was cancelled or rejected');
  }
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !nonce || !verifier) {
    clearTransaction();
    throw new Error('Invalid or expired SSO login transaction');
  }

  try {
    const tokenResponse = await fetch(`${cfg.issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      cache: 'no-store',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        code,
        redirect_uri: cfg.redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) throw new Error('Unable to exchange the Keycloak authorization code');
    const tokenBody = await tokenResponse.json() as { access_token?: string; id_token?: string };
    if (!tokenBody.access_token || !tokenBody.id_token) throw new Error('Keycloak did not return the required tokens');
    await verifyIdToken(tokenBody.id_token, cfg, nonce);

    const sessionResponse = await fetch(`${cfg.authBaseUrl}/api/oidc/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
      body: '{}',
    });
    if (!sessionResponse.ok) {
      if (sessionResponse.status === 403) {
        throw new Error('This account still requires legacy MFA sign-in. Use the existing sign-in method while MFA migration is completed.');
      }
      if (sessionResponse.status === 401) {
        throw new Error('SSO identity is not eligible. Verify your email and TCE account access.');
      }
      throw new Error('Unable to create a TCE session from the SSO identity');
    }
    const session = await sessionResponse.json() as { accessToken?: string };
    if (!session.accessToken) throw new Error('Authentication service returned no app access token');
    return session.accessToken;
  } finally {
    clearTransaction();
  }
}

export function keycloakLogoutUrl(): string | null {
  if (!keycloakSsoEnabled()) return null;
  const cfg = config();
  const endpoint = new URL(`${cfg.issuer}/protocol/openid-connect/logout`);
  endpoint.search = new URLSearchParams({
    client_id: cfg.clientId,
    post_logout_redirect_uri: `${window.location.origin}/login`,
  }).toString();
  return endpoint.toString();
}
