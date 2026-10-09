# MicroFE Auth NestJS implementation contract

## Runtime architecture
- NestJS 11 + TypeScript, strict compile, Node.js 24 to align with the existing TCE service runtime.
- Reuse the existing project patterns under `apps/service/src/auth`: AuthRepository, PasswordService, JwtService, RefreshService, MFA/TOTP/recovery and passkey repositories/services.
- Keep this MicroFE service independently deployable from `microfe/auth` on port 3000. Do not import the whole TCE application into the MicroFE runtime.
- Use `@supabase/supabase-js` from a server-only injectable Supabase client. Never expose service-role credentials in client bundles.

## Existing Supabase contract verified
Live production schema has:
- `public.users(id,email,password_hash,role,mfa_enabled,mfa_secret_encrypted,...)`
- `public.refresh_sessions(id,user_id,token_hash,family_id,replaced_by,expires_at,revoked_at,last_used_at,ip,user_agent,...)`
- `public.mfa_recovery_codes`
- `public.auth_passkey_credentials`
- `public.auth_passkey_challenges`

The production RPC `public.rotate_refresh_token` is present with arguments:
`p_token_hash text, p_new_token_hash text, p_new_expires_at timestamptz, p_ip inet, p_user_agent text`
and returns:
`TABLE(user_id uuid, role text, new_session_id uuid, reuse_detected boolean)`.

Use the RPC atomically and inspect its live definition/security grants before finalizing the service. Do not hand-roll rotation with multiple Data API writes; do not create parallel user/session tables or modify production schema just to fit the service.

## Compatibility endpoints
- `GET /health/live`, `GET /health/ready`, `GET /health`
- `GET /auth/status`
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- preserve MFA/passkey flows as the shared-auth contract requires.

## Mandatory quality/security gates
- DTO validation (`class-validator`), typed services/repositories, centralized safe errors, bounded request body, explicit CORS allowlist.
- Secure session cookies and CSRF validation for cookie-authenticated mutations; hash opaque refresh tokens at rest.
- MFA-enabled users must complete a real challenge before receiving a session. Implement TOTP and recovery-code flows; preserve passkey flows where required. No MFA bypass.
- Confirm logout and logout-all revoke server-side sessions, not just browser cookies.
- Never log passwords, tokens, secret values or MFA secrets.
- Unit and e2e tests for invalid credentials, scrypt/legacy hashes, MFA challenge, recovery codes, passkey challenge lifecycle, CSRF/cookie behavior, token rotation/reuse detection, logout/logout-all, readiness fail-closed.
- Build the ARM64 image from the NestJS TypeScript output; publish immutable commit SHA/digest only from trusted branches. Production dispatch stays gated on all tests and image publish success.
