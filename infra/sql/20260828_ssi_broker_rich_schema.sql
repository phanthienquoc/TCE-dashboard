-- Preserve provider-detail information above the normalized SDK contract.
-- SDK fields remain the canonical minimum; broker_* tables retain richer SSI payloads.

alter table public.tce_broker_accounts
  add column if not exists account_status text,
  add column if not exists account_currency text,
  add column if not exists account_sub_type text,
  add column if not exists is_tradable boolean,
  add column if not exists is_margin_enabled boolean,
  add column if not exists source_version text,
  add column if not exists raw_account_v2 jsonb;

alter table public.tce_broker_assets
  add column if not exists asset_type text,
  add column if not exists sub_type text,
  add column if not exists tradable_quantity numeric,
  add column if not exists pending_quantity numeric,
  add column if not exists t_plus_quantity numeric,
  add column if not exists average_cost numeric,
  add column if not exists last_price numeric,
  add column if not exists valuation_currency text,
  add column if not exists market_value_source text,
  add column if not exists source_version text,
  add column if not exists raw_asset_v2 jsonb;

comment on table public.tce_broker_accounts is 'Provider account snapshot. Contains normalized TCE fields plus provider-specific account metadata.';
comment on table public.tce_broker_assets is 'Provider asset snapshot. Contains normalized TCE fields plus richer broker-specific quantities/valuation metadata.';
comment on column public.tce_broker_accounts.raw_account_v2 is 'Full provider account payload retained for forward compatibility beyond the normalized SDK contract.';
comment on column public.tce_broker_assets.raw_asset_v2 is 'Full provider asset payload retained for forward compatibility beyond the normalized SDK contract.';
