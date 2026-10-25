create table if not exists platform_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('ssi','binance','telegram')),
  environment text not null default 'production' check (environment in ('sandbox','testnet','production')),
  credentials_encrypted text not null,
  encryption_version integer not null default 1,
  is_active boolean not null default true,
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, environment)
);

create index if not exists platform_credentials_user_idx on platform_credentials(user_id);

alter table platform_credentials enable row level security;

create or replace function set_platform_credentials_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists platform_credentials_updated_at on platform_credentials;
create trigger platform_credentials_updated_at
before update on platform_credentials
for each row execute function set_platform_credentials_updated_at();

-- Credentials are intentionally not readable from the browser. The NestJS service
-- uses the service-role connection, decrypts only in memory, and never returns plaintext.
