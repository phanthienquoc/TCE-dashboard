create table if not exists public.auth_passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb not null default '[]'::jsonb,
  friendly_name text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_auth_passkey_credentials_user on public.auth_passkey_credentials(user_id);

create table if not exists public.auth_passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  challenge text not null,
  purpose text not null check (purpose in ('registration','authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_passkey_challenges_lookup on public.auth_passkey_challenges(challenge, purpose);
create index if not exists idx_auth_passkey_challenges_expiry on public.auth_passkey_challenges(expires_at);

alter table public.auth_passkey_credentials enable row level security;
alter table public.auth_passkey_challenges enable row level security;
