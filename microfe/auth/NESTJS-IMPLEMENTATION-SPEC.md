# MicroFE Auth NestJS implementation contract

## Runtime architecture
- NestJS 11 + TypeScript, strict compile, Node.js 24.
- Standalone service in `microfe/auth` on port 3000; do not import the whole TCE application.
- Direct PostgreSQL using the standard `pg` driver and a bounded pool. No `@supabase/supabase-js`, Supabase Data API, Supabase Auth or service-role key in the runtime.
- NestJS owns auth decisions: password verification, MFA/recovery policy, session lifecycle, token rotation/reuse detection, CSRF, passkey challenge lifecycle and credential updates.
- Database is persistent storage/integrity enforcement only; preserve existing shared-auth tables and endpoint/cookie contracts.

## Existing database schema
The verified database contains:
- `public.users(id,email,password_hash,role,mfa_enabled,mfa_secret_encrypted,...)`
- `public.refresh_sessions(id,user_id,token_hash,family_id,replaced_by,expires_at,revoked_at,last_used_at,ip,user_agent,...)`
- `public.mfa_recovery_codes(user_id,code_hash,used_at,...)`
- `public.auth_passkey_credentials`
- `public.auth_passkey_challenges`

Use these existing tables. Do not create duplicate user/session stores or run schema mutations as part of this migration. App code must not invoke auth business RPCs; implement equivalent decisions in NestJS using safe SQL and explicit transactions.

## Compatibility endpoints
- `GET /health/live`, `GET /health/ready`, `GET /health`
- `GET /auth/status`
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- preserve MFA/passkey endpoints required by the shared-auth contract.

## Mandatory quality/security gates
- DTO validation (`class-validator`), typed services/repositories, centralized safe errors, explicit CORS allowlist.
- Secure session cookies and CSRF validation for cookie-authenticated mutations; hash opaque refresh tokens at rest.
- MFA-enabled users must complete a real challenge before receiving a session. No MFA bypass.
- Recovery codes and passkey challenges are one-time use; refresh-token reuse revokes the full token family and must commit that revocation.
- Confirm logout and logout-all revoke server-side sessions, not just browser cookies.
- Never log passwords, tokens, secret values or MFA secrets.
- Unit and e2e tests for invalid credentials, scrypt/legacy hashes, MFA challenge/recovery, passkey challenge lifecycle, CSRF/cookie behavior, token rotation/reuse detection, logout/logout-all, readiness fail-closed.
- Build ARM64 from NestJS output; publish immutable commit SHA/digest only from trusted branches. Deploy only after verified database configuration and green checks.
