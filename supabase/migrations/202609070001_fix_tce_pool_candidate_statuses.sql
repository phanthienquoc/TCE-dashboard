-- Fix pool <-> next-position lifecycle states.
-- Pool entries can be PROMOTED while an active execution candidate exists.
-- Returned candidates use the existing SKIPPED state.

begin;

alter table public.tce_pool_entries
  drop constraint if exists tce_pool_entries_status_check;

alter table public.tce_pool_entries
  add constraint tce_pool_entries_status_check
  check (
    status = ANY (
      ARRAY[
        'WATCHING'::text,
        'TRIGGERED'::text,
        'PROMOTED'::text,
        'POSITIONED'::text,
        'REJECTED'::text,
        'EXPIRED'::text,
        'REMOVED'::text
      ]
    )
  );

commit;
