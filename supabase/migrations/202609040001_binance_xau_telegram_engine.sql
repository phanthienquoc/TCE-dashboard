-- Binance XAU futures trading configuration.
-- All engine settings are scoped to the current TCE account (one config row per account).
alter table if exists public.tce_strategy_config
  add column if not exists binance_engine_enabled boolean not null default false,
  add column if not exists binance_order_quantity numeric not null default 0.01,
  add column if not exists binance_position_side text not null default 'BOTH',
  add column if not exists binance_xau_enabled boolean not null default false,
  add column if not exists binance_xau_symbol text not null default 'XAUUSDT',
  add column if not exists binance_xau_tp_pct numeric not null default 5,
  add column if not exists binance_xau_sl_pct numeric not null default 5,
  add column if not exists binance_xau_auto_protection boolean not null default true,
  add column if not exists binance_xau_notification_id uuid;

alter table if exists public.tce_strategy_config
  drop constraint if exists tce_strategy_config_binance_position_side_check;
alter table if exists public.tce_strategy_config
  add constraint tce_strategy_config_binance_position_side_check
  check (binance_position_side in ('BOTH','LONG','SHORT'));

alter table if exists public.tce_strategy_config
  drop constraint if exists tce_strategy_config_binance_xau_notification_fk;
alter table if exists public.tce_strategy_config
  add constraint tce_strategy_config_binance_xau_notification_fk
  foreign key (binance_xau_notification_id)
  references public.platform_credentials(id)
  on delete set null;

create index if not exists tce_strategy_config_binance_xau_notification_idx
  on public.tce_strategy_config (binance_xau_notification_id);

-- One active Telegram signal per account/environment/symbol is already protected by
-- uq_tce_telegram_active_symbol. This additional index makes realtime watcher lookups cheap.
create index if not exists idx_tce_telegram_signal_symbol_status
  on public.tce_telegram_signals(user_id, environment, symbol, status, created_at);
