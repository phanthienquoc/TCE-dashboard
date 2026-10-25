begin;

create or replace function public.stock_events_load_existing(p_mongo_ids text[])
returns table (
  mongo_id text,
  sync_status text,
  sync_hash text,
  sync_attempts integer
)
language sql
stable
security invoker
as $$
  select
    se.mongo_id,
    se.sync_status,
    se.sync_hash,
    se.sync_attempts
  from public.stock_events se
  where se.mongo_id = any(p_mongo_ids);
$$;

grant execute on function public.stock_events_load_existing(text[]) to service_role;

create or replace function public.stock_events_mark_failed(
  p_mongo_ids text[],
  p_error_message text,
  p_updated_at timestamptz
)
returns void
language sql
volatile
security invoker
as $$
  update public.stock_events
  set
    sync_status = 'FAILED',
    sync_error = p_error_message,
    updated_at = p_updated_at
  where mongo_id = any(p_mongo_ids);
$$;

grant execute on function public.stock_events_mark_failed(text[], text, timestamptz) to service_role;

commit;
