# MicroFE Auth — NestJS + TypeScript migration

## Decision
NestJS + TypeScript is the MicroFE backend standard. Do not ship the legacy Express `server.mjs` implementation.

## Implementation baseline
Reuse the existing NestJS auth patterns in `apps/service/src/auth`:
- AuthController / AuthService / AuthRepository
- RefreshService and atomic `rotate_refresh_token` RPC
- PasswordService (existing compatible password-hash format)
- MFA services and TOTP/recovery flows
- Passkey registration/authentication where supported by the product contract
- SupabaseClientService with server-side service-role access only

Keep the MicroFE service separately deployable at port 3000. Preserve current public endpoint compatibility unless the API contract is versioned deliberately:
- `GET /health/live`, `GET /health/ready`, `GET /health`
- `GET /auth/status`
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`

## Supabase contract checks before implementation
The existing production schema has `public.users`, `public.refresh_sessions`, MFA recovery, and passkey tables. Reuse these tables. Do not create a parallel `microfe_users` or `microfe_sessions` store.

Before wiring refresh rotation, verify the exact `public.rotate_refresh_token` signature, return columns, reuse-detection behavior, grants, and transaction semantics against the live database. Do not infer the RPC contract from a client call alone.

## Security and compatibility requirements
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to a browser/client bundle.
- Keep session tokens opaque and store hashes only.
- Preserve secure HttpOnly cookies and validate CSRF for cookie-authenticated mutating endpoints.
- Do not bypass MFA for accounts where `mfa_enabled=true`; implement a complete MFA challenge, TOTP/recovery verification, and session issuance flow.
- Preserve passkey flows if they are part of the existing shared-auth contract.
- Validate input with DTOs and `class-validator`; use strict TypeScript and centralized exception handling.
- Keep secrets out of logs and Git.
- Do not run schema mutations against production as part of this migration unless a reviewed migration proves they are required.

## CI gates
1. NestJS TypeScript build and lint.
2. Unit tests for password verification, MFA/TOTP, session lookup, token rotation/reuse detection, CSRF and cookie behavior.
3. E2E tests for signup/login/MFA/refresh/logout/logout-all and readiness fail-closed behavior.
4. Build the ARM64 container and publish only from trusted non-PR events.
5. Promote immutable image digests via platform-infra; verify rollout and public health endpoints before reporting production healthy.

## Infrastructure follow-up
The platform-infra PR must be based on this NestJS implementation. Confirm the source namespace and presence of required secret keys by key names only before copying credentials to `microfe-platform/microfe-auth-secrets`. Never print secret values in logs.
