-- Credential material is accessed by the NestJS service-role connection only.
-- Do not expose encrypted credential rows through authenticated browser policies.
drop policy if exists platform_credentials_select_own on public.platform_credentials;
drop policy if exists platform_credentials_insert_own on public.platform_credentials;
drop policy if exists platform_credentials_update_own on public.platform_credentials;
drop policy if exists platform_credentials_delete_own on public.platform_credentials;
alter table public.platform_credentials enable row level security;
