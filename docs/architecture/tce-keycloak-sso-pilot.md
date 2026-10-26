# TCE Dashboard — Keycloak SSO pilot

## Scope

This is an opt-in first-consumer integration. The default remains legacy auth unless the web build explicitly sets `NEXT_PUBLIC_AUTH_MODE=keycloak`. It does not deploy anything, change the Keycloak realm, apply Supabase migrations, or switch live traffic.

## Flow

```mermaid
sequenceDiagram
    actor User
    participant TCE as TCE Dashboard (browser)
    participant KC as Keycloak (sso.mrcute.space)
    participant Auth as Central Auth (auth.mrcute.space)
    participant API as TCE Service
    participant DB as Shared application DB

    User->>TCE: Continue with MrCute ID
    TCE->>TCE: Generate state, nonce and PKCE S256 verifier
    TCE->>KC: Authorization Code + PKCE
    KC-->>TCE: Redirect with code and state
    TCE->>TCE: Verify state; exchange code; check ID-token nonce
    TCE->>Auth: POST /api/oidc/session (Keycloak access token)
    Auth->>KC: Validate RS256 signature via JWKS, issuer, audience, expiry
    Auth->>Auth: Require azp=tce-dashboard and email_verified=true
    Auth->>DB: Match exact email to existing ACTIVE app account
    Auth-->>TCE: App access JWT + HttpOnly refresh cookie
    TCE->>API: API requests with app JWT in Authorization header
    API->>API: Verify app JWT using shared JWT_SECRET
    API-->>TCE: Authorized account-scoped response
```

## Configuration

Set these build-time public variables only when enabling the pilot:

```dotenv
NEXT_PUBLIC_AUTH_MODE=keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://sso.mrcute.space
NEXT_PUBLIC_KEYCLOAK_REALM=mrcute
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=tce-dashboard
NEXT_PUBLIC_AUTH_BASE_URL=https://auth.mrcute.space
```

The existing Keycloak realm template declares a public `tce-dashboard` client, Authorization Code flow, PKCE S256, and a redirect allowlist for `https://tce.mrcute.space/*`. Verify the actual live realm/client settings independently before enabling this flag.

Central Auth requires server-side `KEYCLOAK_TCE_CLIENT_ID=tce-dashboard`. Its existing `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ISSUER` and `KEYCLOAK_AUDIENCE` must be correctly configured, and the token must contain the expected API audience.

**Critical compatibility contract:** TCE's service verifies app access JWTs with its own `JWT_SECRET`; this must be the exact same secret as central Auth's `JWT_SECRET` for this current shared-HS256-token bridge. Verify secret presence/equality without printing values before enabling SSO. If the secrets differ, the API must reject the token; do not weaken verification or make the secret public.

## Security and compatibility behavior

- The browser uses Authorization Code + PKCE S256, a cryptographically random state and nonce, and stores only the short-lived PKCE transaction in `sessionStorage`. App access tokens are held in memory; refresh tokens remain HttpOnly cookies.
- The callback checks the returned state and ID-token nonce. The central Auth API independently validates the access-token signature, exact issuer, audience, expiry and RS256 algorithm using JWKS.
- The session exchange accepts only the configured `azp` client and a Keycloak token with `email_verified=true`.
- It links only to an existing ACTIVE account by exact email. It does not auto-create accounts, update roles, or use Keycloak role claims to grant TCE trading permissions.
- Accounts with legacy app-managed MFA are rejected by the exchange and can continue using legacy sign-in. This deliberately avoids silently bypassing an existing MFA requirement while MFA assurance migration is unfinished.
- The central Auth refresh cookie path is `/auth`, matching the existing public `/auth/*` route contract.
- The frontend attaches the in-memory app JWT to TCE API requests and refreshes it once after a 401 using the HttpOnly refresh cookie. It never stores access/refresh tokens in localStorage.
- Logout clears the central app session and redirects through the Keycloak end-session endpoint. Actual IdP logout behavior must be tested against the live client and its post-logout redirect allowlist.
- Legacy login/passkey flows remain available. Do not remove them as part of this pilot.

## Acceptance gates before enabling the flag

1. Merge and deploy the central Auth session-exchange change through its normal GitOps release flow.
2. Confirm the central Auth `KEYCLOAK_TCE_CLIENT_ID`, issuer, audience mapper, public client, callback and post-logout redirect are correct in the non-production Keycloak realm.
3. Confirm the TCE service's JWT signing secret matches central Auth's signing secret without disclosing either value.
4. Test successful login for an existing ACTIVE account with verified email; reject unverified email, wrong `azp`, invalid signature, wrong issuer/audience, expired token, unknown account, suspended account and legacy-MFA account.
5. Test refresh, expiry/retry, app logout, IdP logout, CORS, cookies and iOS Safari behavior.
6. Verify no account IDs, role assignments, trading configuration, order state or Supabase rows are altered by login. Do not run live orders as part of auth validation.
7. Only enable `NEXT_PUBLIC_AUTH_MODE=keycloak` for a non-production build after the above checks. Production cutover requires a separate explicit rollout and rollback review.

## Not yet proven

A passing build does not prove the runtime Keycloak client, central Auth environment variables, JWT-secret equality, browser CORS/cookie behavior, or end-to-end SSO/logout. No deployment or live realm changes are performed by this code change.