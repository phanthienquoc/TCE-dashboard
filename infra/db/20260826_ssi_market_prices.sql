create table if not exists public.tce_market_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  symbol text not null,
  trading_date date not null,
  price numeric not null,
  close_price numeric,
  source text not null default 'ssi',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol, trading_date)
);

create index if not exists idx_tce_market_prices_user_date on public.tce_market_prices(user_id, trading_date desc);
create index if not exists idx_tce_market_prices_symbol_date on public.tce_market_prices(symbol, trading_date desc);
