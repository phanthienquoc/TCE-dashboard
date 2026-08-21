create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'USER' check (role in ('USER','ADMIN')),
  mfa_enabled boolean not null default false,
  mfa_secret_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  family_id uuid not null,
  replaced_by uuid references refresh_sessions(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  ip inet,
  user_agent text
);
create index if not exists refresh_sessions_user_idx on refresh_sessions(user_id);
create index if not exists refresh_sessions_family_idx on refresh_sessions(family_id);

create table if not exists mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfa_recovery_user_idx on mfa_recovery_codes(user_id);
