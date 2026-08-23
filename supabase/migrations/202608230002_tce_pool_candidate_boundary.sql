-- TCE architecture boundary:
-- tce_pool_entries = hunting intelligence / Pool 5
-- tce_buy_candidates = execution queue for the selected buy candidate(s)

alter table public.tce_buy_candidates
  add column if not exists pool_entry_id uuid references public.tce_pool_entries(id) on delete set null;

alter table public.tce_buy_candidates
  add column if not exists promoted_at timestamptz;

create index if not exists idx_tce_buy_candidates_pool_entry
  on public.tce_buy_candidates(account_id, pool_entry_id);

-- The execution queue can hold the two candidates corresponding to the two
-- permitted TCE positions. Runtime capacity remains enforced by max_positions.
comment on table public.tce_pool_entries is 'TCE hunting intelligence: ranked Pool 5 candidates. Not an execution queue.';
comment on table public.tce_buy_candidates is 'TCE execution queue: only promoted pool candidates that are ready/queued for an actual buy decision.';
comment on column public.tce_buy_candidates.pool_entry_id is 'Source Pool 5 entry promoted into the execution queue.';
comment on column public.tce_buy_candidates.promoted_at is 'Timestamp when the pool candidate became an execution candidate.';
