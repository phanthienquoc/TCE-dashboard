# TCE data model boundary

## Pool 5
`public.tce_pool_entries` is the research/hunting layer. It stores ranked candidates and the scoring dimensions used to decide whether a symbol is worth promoting.

## Buy execution queue
`public.tce_buy_candidates` is the execution-intent layer. A row here means a Pool 5 candidate has passed the execution gate. `pool_entry_id` links it back to the source research row and `promoted_at` records the transition time.

## Position
`public.tce_positions` is the current position state. The strategy configuration limits this to two active positions.

## Monitoring
`public.tce_position_snapshots` stores hourly observations for active positions and `public.tce_monitor_runs` stores monitor audit records.

## Cashout
`public.tce_cashout_events` records cashout events and `public.tce_cashflows` remains the broader cash ledger.

Pipeline:

`Market Scan -> Pool 5 -> Buy Candidate -> Position -> T+2 Monitor -> Cashout -> Cashflow/Cycle`

The pool and candidate tables are intentionally separate; they are not duplicate storage.