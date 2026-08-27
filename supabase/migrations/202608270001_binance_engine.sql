begin;

-- Binance Futures engine runtime configuration.
-- Quantity is deliberately explicit: the engine never invents a live order size.
alter table public.tce_strategy_config
  add column if not exists binance_engine_enabled boolean not null default false,
  add column if not exists binance_order_quantity numeric,
  add column if not exists binance_position_side text not null default 'BOTH';

alter table public.tce_strategy_config
  drop constraint if exists tce_strategy_config_binance_position_side_check;

alter table public.tce_strategy_config
  add constraint tce_strategy_config_binance_position_side_check
  check (binance_position_side in ('BOTH', 'LONG', 'SHORT'));

commit;
