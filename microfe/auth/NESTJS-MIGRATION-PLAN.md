# MicroFE Auth — NestJS + TypeScript migration

## Decision
NestJS owns all authentication and authorization business logic. The service accesses the existing PostgreSQL database through the standard `pg` driver; no Supabase SDK, Data API, Auth product or service-role key is part of the runtime.

## Implementation baseline
- AuthController / AuthService / AuthRepository
- PostgresService with bounded connection pool and transaction helper
- PasswordService compatible with the existing `salt:hex` scrypt format
- MFA/TOTP/recovery flows and signed short-lived MFA challenges
- Passkey registration/authentication, one-time challenge consumption and credential-counter handling

Keep the MicroFE service separately deployable at port 3000. Preserve current public endpoint and cookie compatibility:
- `GET /health/live`, `GET /health/ready`, `GET /health`
- `GET /auth/status`
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- existing MFA and passkey endpoints

## Database contract
Reuse the existing `public.users`, `public.refresh_sessions`, `public.mfa_recovery_codes`, `public.auth_passkey_credentials`, and `public.auth_passkey_challenges` tables. No parallel user/session store and no production schema mutation for this migration.

Use parameterized SQL for every input. Refresh rotation and recovery/challenge consumption must be transactional and tested under concurrent requests. Do not call `rotate_refresh_token` or `consume_recovery_code` RPCs from application code; their business decisions move into NestJS + PostgreSQL transactions.

## Security and compatibility requirements
- Keep session tokens opaque and store only hashes.
- Preserve secure HttpOnly session cookies and validate CSRF for cookie-authenticated mutations.
- Do not bypass MFA for accounts where `mfa_enabled=true`.
- Preserve passkey flows and existing password hash compatibility.
- Validate input with DTOs and `class-validator`; keep secrets and authentication material out of logs/Git.
- Use `DATABASE_URL`, bounded `DB_POOL_MAX`, `JWT_SECRET`, and `MFA_ENCRYPTION_KEY`. Do not put Supabase service-role credentials into the Auth workload.

## CI/release gates
1. NestJS TypeScript build/check and unit tests pass.
2. Verify password hashes, MFA encryption format, table columns/indexes and passkey API compatibility.
3. Test refresh rotation/reuse, recovery-code single use and passkey challenge single use under concurrent requests.
4. Verify DB connection secret exists by key name only; never print its value.
5. Build an ARM64 image and publish immutable commit SHA/digest only from trusted branches.
6. Promote via platform-infra only after all checks; verify rollouts and public health endpoints.
