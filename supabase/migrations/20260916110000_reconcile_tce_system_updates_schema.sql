begin;

alter table public.tce_system_updates
  add column if not exists title text not null default 'TCE Dashboard updated';

alter table public.tce_system_updates
  add column if not exists release_url text;

notify pgrst, 'reload schema';

commit;
