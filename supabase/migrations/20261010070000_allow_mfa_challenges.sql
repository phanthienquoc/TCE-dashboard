-- Permit NestJS Auth to store short-lived MFA challenges in the existing
-- shared challenge table. This migration must be applied before deploying the
-- MicroFE Auth image that writes purpose = 'mfa'.
ALTER TABLE public.auth_passkey_challenges
  DROP CONSTRAINT IF EXISTS auth_passkey_challenges_purpose_check;

ALTER TABLE public.auth_passkey_challenges
  ADD CONSTRAINT auth_passkey_challenges_purpose_check
  CHECK (purpose = ANY (ARRAY['registration'::text, 'authentication'::text, 'mfa'::text]));
