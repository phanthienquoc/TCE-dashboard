-- Required by direct NestJS-owned MFA challenge storage.
-- Review and apply through the normal migration process before deploying this code.
ALTER TABLE public.auth_passkey_challenges
  DROP CONSTRAINT IF EXISTS auth_passkey_challenges_purpose_check;

ALTER TABLE public.auth_passkey_challenges
  ADD CONSTRAINT auth_passkey_challenges_purpose_check
  CHECK (purpose = ANY (ARRAY['registration'::text, 'authentication'::text, 'mfa'::text]));
