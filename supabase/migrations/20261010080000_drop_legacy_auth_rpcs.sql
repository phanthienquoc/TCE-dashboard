-- Retire auth business-logic RPCs only after TCE service and MicroFE Auth
-- have been deployed with the NestJS/PostgreSQL transaction implementations.
-- Do not apply this migration before the application rollout has completed.
DROP FUNCTION IF EXISTS public.consume_recovery_code(uuid, text);
DROP FUNCTION IF EXISTS public.rotate_refresh_token(text, text, timestamp with time zone, inet, text);
