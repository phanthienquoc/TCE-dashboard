begin;

alter table public.tce_accounts
  add column if not exists external_account_no text;

comment on column public.tce_accounts.external_account_no is
  'Canonical external trading account identifier for broker execution.';

commit;
