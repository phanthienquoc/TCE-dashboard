# MicroFE Auth — NestJS + TypeScript migration

## Decision
NestJS owns all authentication and authorization business logic. The service accesses the existing PostgreSQL database through the standard `pg` driver; no Supabase SDK, Data API, Auth product or service-role key is part of the runtime.

## Implementation baseline
- AuthController / AuthService / AuthRepository
- PostgresService with bounded connection pool and transaction helper
- PasswordService compatible with the existing `salt:hex` scrypt format
- MFA/TOTP/recovery flows with signed short-lived challenge tokens
- Passkey registration/authentication with transactional one-time challenge consumption

Keep MicroFE Auth separately deployable at port 3000. Preserve existing health/auth routes, session cookies and CSRF contract.

## Database contract
Reuse existing `public.users`, `public.refresh_sessions`, `public.mfa_recovery_codes`, `public.auth_passkey_credentials`, and `public.auth_passkey_challenges`. Do not create duplicate user/session stores.

Use parameterized SQL for every request. Refresh rotation, recovery-code consumption, MFA challenge consumption, and passkey challenge consumption are implemented in NestJS with PostgreSQL transactions; the service must not invoke `rotate_refresh_token` or `consume_recovery_code` RPCs. Migration `microfe/auth/migrations/0001_allow_mfa_challenges.sql` extends the existing challenge-purpose check constraint to include `mfa`; apply it through the reviewed database migration process before deployment.

## Security/release gates
- Keep only opaque session-token hashes in the database.
- Preserve password/MFA-encryption compatibility and all MFA/passkey endpoints.
- Ensure refresh reuse revokes the entire token family and commits the revocation.
- Unit and e2e tests must cover password, MFA/recovery, refresh reuse, CSRF/cookies, passkeys and readiness.
- Production release also requires a verified `DATABASE_URL` key in `tce-prod/tce-app-secrets`, `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, a green Auth CI run and immutable image digest.
- No production schema mutation/deployment until those gates pass.
