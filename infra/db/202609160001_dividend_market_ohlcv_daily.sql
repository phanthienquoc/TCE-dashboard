create table if not exists public.tce_market_ohlcv_daily (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  trading_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  source text not null default 'ssi',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, trading_date)
);

create index if not exists idx_tce_market_ohlcv_daily_symbol_date
  on public.tce_market_ohlcv_daily(symbol, trading_date desc);

alter table public.tce_market_ohlcv_daily enable row level security;

grant select on public.tce_market_ohlcv_daily to authenticated;

drop policy if exists "authenticated can read dividend market ohlcv" on public.tce_market_ohlcv_daily;
create policy "authenticated can read dividend market ohlcv"
  on public.tce_market_ohlcv_daily
  for select
  to authenticated
  using (exists (
    select 1
    from public.stock_events se
    where upper(se.symbol) = upper(tce_market_ohlcv_daily.symbol)
  ));
