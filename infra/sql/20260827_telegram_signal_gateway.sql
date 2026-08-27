create table if not exists public.tce_telegram_signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.tce_accounts(id) on delete cascade,
  environment text not null default 'production',
  telegram_update_id bigint,
  telegram_chat_id text,
  raw_message text not null,
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  entry numeric not null,
  tp numeric not null,
  sl numeric not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','ACCEPTED','REJECTED','EXECUTED','FAILED')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, environment, telegram_update_id)
);
create index if not exists idx_tce_telegram_signals_queue on public.tce_telegram_signals(account_id, environment, status, created_at);
