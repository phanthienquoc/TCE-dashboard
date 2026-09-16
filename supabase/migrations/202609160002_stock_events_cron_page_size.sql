begin;

alter table public.tce_cron_jobs
  add column if not exists page_size integer not null default 10;

alter table public.tce_cron_jobs
  drop constraint if exists tce_cron_jobs_page_size_check;

alter table public.tce_cron_jobs
  add constraint tce_cron_jobs_page_size_check check (page_size between 1 and 100);

commit;
