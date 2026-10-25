alter table public.platform_credentials
  add column if not exists credential_name text not null default 'default';

drop index if exists platform_credentials_user_provider_environment_key;
alter table public.platform_credentials drop constraint if exists platform_credentials_user_id_provider_environment_key;
alter table public.platform_credentials add constraint platform_credentials_user_provider_environment_name_key
  unique (user_id, provider, environment, credential_name);

alter table public.platform_credentials drop constraint if exists platform_credentials_provider_check;
alter table public.platform_credentials add constraint platform_credentials_provider_check
  check (provider in ('ssi', 'binance', 'fastapi', 'telegram'));

create table if not exists public.telegram_debug_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_credential_id uuid not null references public.platform_credentials(id) on delete cascade,
  service_name text not null,
  min_level text not null default 'INFO' check (min_level in ('DEBUG','INFO','WARN','ERROR')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, telegram_credential_id, service_name)
);

create index if not exists telegram_debug_assignments_user_idx
  on public.telegram_debug_assignments(user_id, enabled);
create index if not exists telegram_debug_assignments_service_idx
  on public.telegram_debug_assignments(user_id, service_name, enabled);

alter table public.telegram_debug_assignments enable row level security;

create or replace function set_telegram_debug_assignment_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists telegram_debug_assignments_updated_at on public.telegram_debug_assignments;
create trigger telegram_debug_assignments_updated_at
before update on public.telegram_debug_assignments
for each row execute function set_telegram_debug_assignment_updated_at();
