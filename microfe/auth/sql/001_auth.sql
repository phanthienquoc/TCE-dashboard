create table if not exists microfe_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  roles text[] not null default '{}',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists microfe_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references microfe_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  csrf_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists microfe_sessions_user_idx on microfe_sessions(user_id);
create index if not exists microfe_sessions_expires_idx on microfe_sessions(expires_at);