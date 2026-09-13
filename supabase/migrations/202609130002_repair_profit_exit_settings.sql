begin;

-- Production repair: keep the API contract present even when the original
-- engine-schedule migration was not applied before the service deployment.
alter table public.tce_strategy_config
  add column if not exists auto_sell_enabled boolean not null default false,
  add column if not exists auto_sell_profit_target_pct numeric not null default 10,
  add column if not exists auto_sell_interval_minutes integer not null default 60,
  add column if not exists auto_sell_last_run_at timestamptz;

alter table public.tce_strategy_config
  drop constraint if exists tce_strategy_config_auto_sell_profit_target_pct_check,
  drop constraint if exists tce_strategy_config_auto_sell_interval_minutes_check;

alter table public.tce_strategy_config
  add constraint tce_strategy_config_auto_sell_profit_target_pct_check
    check (auto_sell_profit_target_pct >= 0 and auto_sell_profit_target_pct <= 1000),
  add constraint tce_strategy_config_auto_sell_interval_minutes_check
    check (auto_sell_interval_minutes >= 1 and auto_sell_interval_minutes <= 1440);

commit;
