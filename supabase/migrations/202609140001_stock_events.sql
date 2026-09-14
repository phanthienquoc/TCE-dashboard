create table if not exists public.stock_events (
  id uuid primary key default gen_random_uuid(),
  mongo_id text not null unique,
  symbol text,
  exchange text,
  ex_right_date date,
  record_date date,
  payment_date date,
  event_content text,
  ratio_text text,
  dividend_value numeric,
  reference_price numeric,
  gdkhq_timestamp timestamptz,
  crawled_at timestamptz,
  synced_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_events_symbol_gdkhq_idx
  on public.stock_events (symbol, gdkhq_timestamp desc);
create index if not exists stock_events_ex_right_date_idx
  on public.stock_events (ex_right_date);
create index if not exists stock_events_exchange_idx
  on public.stock_events (exchange);

alter table public.stock_events enable row level security;
