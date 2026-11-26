# TCE authentication architecture

TCE uses the central NestJS authentication service at `https://auth.mrcute.space` for application authentication. The service persists application identities and sessions in the existing shared Supabase project using its backend-only service-role client.

Supported login methods are the existing email/password, app-managed MFA/TOTP/recovery flow, and WebAuthn passkeys. The canonical application account store is `public.users`; session, MFA and passkey metadata remain in the existing application tables. Do not create duplicate user identities in Supabase Auth `auth.users`, and do not modify existing password hashes or passkey credentials during infrastructure migration.

The TCE frontend calls the central Auth `/auth/*` contract. Its HttpOnly refresh cookie, access-token handling and account-scoped cache clearing remain part of the integration contract. `auth.mrcute.space` is the custom application Auth API and must not be confused with the former Keycloak issuer at `sso.mrcute.space`.

Keycloak/OIDC browser login and session exchange have been retired from the TCE client and central Auth application in the accompanying migration PRs. Retirement of the live Keycloak deployment, host DNS records and Keycloak database is a separate infrastructure action; do not destroy these resources without a reviewed backup/rollback and explicit authorization.

No password, service-role key, signing key, MFA encryption key or other secret belongs in source control or frontend environment variables.
