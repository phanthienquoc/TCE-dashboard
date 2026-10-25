alter table public.platform_credentials
  add column if not exists telegram_paused boolean not null default false;

create index if not exists platform_credentials_telegram_active_idx
  on public.platform_credentials(user_id, provider, is_active, telegram_paused)
  where provider = 'telegram';
