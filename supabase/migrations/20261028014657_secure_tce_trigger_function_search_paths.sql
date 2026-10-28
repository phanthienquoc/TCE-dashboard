-- Source for the manually applied Supabase migration:
-- remote ledger version 20261028014657 (secure_tce_trigger_function_search_paths).
-- These trigger functions use NEW/OLD and public-qualified table names only.
-- Pinning search_path prevents resolution through caller-controlled schemas.
-- The Media Generation trigger function set_video_generation_updated_at() is
-- intentionally excluded because that repository is outside this task scope.

ALTER FUNCTION public.tce_touch_updated_at()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.set_platform_credentials_updated_at()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.set_platform_configs_updated_at()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.set_telegram_debug_assignment_updated_at()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.sync_tce_account_external_account_no()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.sync_tce_position_user_id()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.sync_tce_positions_on_account_user_change()
  SET search_path = pg_catalog, public, pg_temp;
