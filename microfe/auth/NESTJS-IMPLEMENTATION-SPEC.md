# MicroFE Auth NestJS implementation contract

## Runtime architecture
- Standalone NestJS 11 + TypeScript service on Node.js 24, port 3000.
- Direct PostgreSQL via `pg` and a bounded pool. No `@supabase/supabase-js`, Supabase Data API/Auth, service-role key, or auth business RPC calls in runtime.
- NestJS owns password verification, MFA/recovery policy, session lifecycle, refresh rotation/reuse detection, CSRF, passkey challenge lifecycle, and credential counter updates.
- Database provides persistence and integrity only. Preserve existing shared-auth tables, public endpoints and cookie contract.

## Existing database contract
Reuse `public.users`, `public.refresh_sessions`, `public.mfa_recovery_codes`, `public.auth_passkey_credentials`, and `public.auth_passkey_challenges`. No duplicate stores and no production schema mutation unless reviewed and required. All dynamic values must be passed as SQL parameters.

## Compatibility routes
- `GET /health/live`, `GET /health/ready`, `GET /health`
- `GET /auth/status`
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- Preserve all MFA/passkey flows required by the shared-auth contract.

## Mandatory quality/security gates
- DTO validation, strict TypeScript, explicit CORS allowlist and safe errors.
- HttpOnly Secure session cookie, CSRF validation for cookie-authenticated mutations, and hashes-only session storage.
- No MFA bypass. Recovery codes and passkey challenges single-use; refresh-token reuse revokes its family and commits.
- Verify legacy scrypt hash and MFA-secret encryption compatibility.
- Test invalid credentials, MFA/recovery, refresh rotation/reuse, concurrent one-time consumption, CSRF/cookies, passkeys, logout and readiness.
- Use `DATABASE_URL`, bounded `DB_POOL_MAX`, `JWT_SECRET`, and `MFA_ENCRYPTION_KEY`; never expose secret values in logs/Git.
- Publish/deploy immutable images only after green required checks and confirmed DB connectivity.
