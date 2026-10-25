create or replace view public.tce_stock_event_market_metrics as
select
  se.id,
  se.mongo_id,
  se.symbol,
  se.ex_right_date,
  se.gdkhq_timestamp,
  se.payment_date,
  se.event_content,
  se.ratio_text,
  se.dividend_value,
  se.reference_price,
  se.crawled_at,
  coalesce(latest.price, latest_ohlcv.close) as current_price,
  coalesce(latest.trading_date, latest_ohlcv.trading_date) as current_price_date,
  history.one_year_low,
  history.one_year_high,
  case
    when coalesce(latest.price, latest_ohlcv.close) > 0 and coalesce(se.dividend_value, 0) > 0
      then (se.dividend_value::numeric / coalesce(latest.price, latest_ohlcv.close)::numeric) * 100
    else null
  end as dividend_yield_pct
from public.stock_events se
left join lateral (
  select mp.price, mp.trading_date
  from public.tce_market_prices mp
  where upper(mp.symbol) = upper(se.symbol)
  order by mp.trading_date desc, mp.observed_at desc
  limit 1
) latest on true
left join lateral (
  select ohlc.close, ohlc.trading_date
  from public.tce_market_ohlcv_daily ohlc
  where upper(ohlc.symbol) = upper(se.symbol)
  order by ohlc.trading_date desc
  limit 1
) latest_ohlcv on true
left join lateral (
  select
    min(ohlc.low) as one_year_low,
    max(ohlc.high) as one_year_high
  from public.tce_market_ohlcv_daily ohlc
  where upper(ohlc.symbol) = upper(se.symbol)
    and ohlc.trading_date >= (current_date - interval '365 days')::date
    and ohlc.trading_date <= current_date
) history on true;

comment on view public.tce_stock_event_market_metrics is
  'Upcoming stock-event market metrics: current price prefers latest market quote and falls back to latest daily OHLCV close; 365-day low/high from daily OHLCV.';
