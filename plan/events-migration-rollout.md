# Events migration rollout

1. Run `npm run migrate:events` with `MONGO_EVENTS_MIGRATION_LIMIT` for controlled samples.
2. Reconcile sample rows before increasing the limit.
3. Run the command without a limit for the full source backfill.
4. Query Supabase for count, distinct `mongo_id`, symbols, timestamp range and required-field nulls.
5. Set `STOCK_EVENTS_READ_SOURCE=shadow` and observe comparison against Mongo.
6. Only after zero material drift, set `STOCK_EVENTS_READ_SOURCE=supabase` for cutover.
7. Keep Mongo intact/read-only for the rollback window.
8. Remove Mongo dependency only after the repo-wide inventory is clean.
