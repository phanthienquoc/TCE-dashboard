-- Keep tce_positions.user_id derived from the owning TCE account.
update public.tce_positions p
set user_id = a.user_id
from public.tce_accounts a
where p.account_id = a.id
  and p.user_id is distinct from a.user_id;

create or replace function public.sync_tce_position_user_id()
returns trigger
language plpgsql
as $$
begin
  select a.user_id into new.user_id
  from public.tce_accounts a
  where a.id = new.account_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_tce_position_user_id on public.tce_positions;
create trigger trg_sync_tce_position_user_id
before insert or update of account_id, user_id on public.tce_positions
for each row execute function public.sync_tce_position_user_id();

create or replace function public.sync_tce_positions_on_account_user_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    update public.tce_positions
    set user_id = new.user_id,
        updated_at = now()
    where account_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_tce_positions_on_account_user_change on public.tce_accounts;
create trigger trg_sync_tce_positions_on_account_user_change
after update of user_id on public.tce_accounts
for each row execute function public.sync_tce_positions_on_account_user_change();

create table if not exists public.tce_telegram_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  environment text not null default 'production',
  telegram_update_id bigint,
  telegram_chat_id text,
  raw_message text not null,
  symbol text not null,
  side text not null check (side in ('BUY','SELL')),
  entry numeric not null,
  tp numeric not null,
  sl numeric not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','ACCEPTED','REJECTED','EXECUTED','FAILED')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, environment, telegram_update_id)
);

create index if not exists idx_tce_telegram_signals_queue
  on public.tce_telegram_signals(user_id, environment, status, created_at);

create unique index if not exists uq_tce_telegram_active_symbol
  on public.tce_telegram_signals(user_id, environment, symbol)
  where status in ('QUEUED', 'ACCEPTED');
