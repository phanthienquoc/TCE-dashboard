-- Binance XAU futures trading configuration.
-- Stores the execution policy alongside the existing Binance engine config.
alter table if exists public.tce_strategy_config
  add column if not exists binance_xau_enabled boolean not null default false,
  add column if not exists binance_xau_symbol text not null default 'XAUUSDT',
  add column if not exists binance_xau_tp_pct numeric not null default 5,
  add column if not exists binance_xau_sl_pct numeric not null default 5,
  add column if not exists binance_xau_auto_protection boolean not null default true;

-- One active Telegram signal per account/environment/symbol is already protected by
-- uq_tce_telegram_active_symbol. This additional index makes realtime watcher lookups cheap.
create index if not exists idx_tce_telegram_signal_symbol_status
  on public.tce_telegram_signals(user_id, environment, symbol, status, created_at);
