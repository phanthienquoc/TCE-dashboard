begin;

create or replace function public.sync_tce_account_external_account_no()
returns trigger
language plpgsql
as $$
begin
  if new.provider = 'ssi'
     and new.environment = 'production'
     and new.credential_name = 'default'
     and new.is_active
     and nullif(trim(new.ssi_account_no), '') is not null then
    update public.tce_accounts
    set external_account_no = trim(new.ssi_account_no),
        updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_tce_account_external_account_no
  on public.platform_credentials;

create trigger trg_sync_tce_account_external_account_no
after insert or update of ssi_account_no, is_active, provider, environment, credential_name, user_id
on public.platform_credentials
for each row
execute function public.sync_tce_account_external_account_no();

update public.tce_accounts a
set external_account_no = pc.ssi_account_no,
    updated_at = now()
from public.platform_credentials pc
where pc.user_id = a.user_id
  and pc.provider = 'ssi'
  and pc.environment = 'production'
  and pc.credential_name = 'default'
  and pc.is_active = true
  and nullif(trim(pc.ssi_account_no), '') is not null
  and a.external_account_no is distinct from pc.ssi_account_no;

comment on function public.sync_tce_account_external_account_no() is
  'Keeps the canonical TCE external account identity synchronized from the active production SSI credential.';

commit;
