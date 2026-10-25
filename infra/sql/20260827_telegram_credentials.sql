alter table public.platform_credentials drop constraint if exists platform_credentials_provider_check;
alter table public.platform_credentials add constraint platform_credentials_provider_check check (provider in ('ssi','binance','telegram'));
