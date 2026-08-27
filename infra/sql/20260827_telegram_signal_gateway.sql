create table if not exists public.tce_telegram_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  environment text not null default 'production',
  telegram_update_id bigint,
  telegram_chat_id text,
  raw_message text not null,
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  entry numeric not null,
  tp numeric not null,
  sl numeric not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','PROCESSING','ACCEPTED','EXECUTING','PROTECTED','EXECUTED','REJECTED','FAILED')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, environment, telegram_update_id)
);

create index if not exists idx_tce_telegram_signals_queue
  on public.tce_telegram_signals(user_id, environment, status, created_at);

-- Database-level backstop: even concurrent Telegram requests cannot queue
-- two active signals for the same account/environment/symbol.
create unique index if not exists uq_tce_telegram_active_symbol
  on public.tce_telegram_signals(user_id, environment, symbol)
  where status in ('QUEUED','PROCESSING','ACCEPTED','EXECUTING','PROTECTED');
