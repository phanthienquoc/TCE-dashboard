create table if not exists public.tce_system_updates (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null default 'TCE Dashboard updated',
  message text not null,
  release_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.tce_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tce_push_subscriptions_user_id
  on public.tce_push_subscriptions(user_id);

alter table public.tce_system_updates enable row level security;
alter table public.tce_push_subscriptions enable row level security;

revoke all on public.tce_system_updates from anon, authenticated;
revoke all on public.tce_push_subscriptions from anon, authenticated;
