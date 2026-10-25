begin;

-- TCE engine configuration used by the dashboard/service contract.
-- Keep the persisted DB contract at least as expressive as the BE contract.
alter table public.tce_strategy_config
  add column if not exists engine_enabled boolean not null default false,
  add column if not exists profit_target_pct numeric not null default 10,
  add column if not exists max_asset_allocation_pct numeric not null default 40,
  add column if not exists buy_quantity_step integer not null default 100,
  add column if not exists buy_from_remaining_budget boolean not null default true;

alter table public.tce_strategy_config
  drop constraint if exists tce_strategy_config_profit_target_pct_check,
  drop constraint if exists tce_strategy_config_max_asset_allocation_pct_check,
  drop constraint if exists tce_strategy_config_buy_quantity_step_check;

alter table public.tce_strategy_config
  add constraint tce_strategy_config_profit_target_pct_check
    check (profit_target_pct >= 0),
  add constraint tce_strategy_config_max_asset_allocation_pct_check
    check (max_asset_allocation_pct >= 0 and max_asset_allocation_pct <= 100),
  add constraint tce_strategy_config_buy_quantity_step_check
    check (buy_quantity_step >= 1);

commit;
