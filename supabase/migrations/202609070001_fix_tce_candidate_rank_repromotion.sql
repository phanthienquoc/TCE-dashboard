begin;

-- A returned/skipped candidate is historical and must not reserve its Next Position rank.
-- Keep the uniqueness guarantee only for active execution candidates.
alter table public.tce_buy_candidates
  drop constraint if exists tce_buy_candidates_account_id_rank_key;

create unique index if not exists uq_tce_buy_candidates_active_account_rank
  on public.tce_buy_candidates(account_id, rank)
  where status in ('queued', 'ready');

commit;
