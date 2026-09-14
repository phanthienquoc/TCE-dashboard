# Stock events shadow rollout

`STOCK_EVENTS_READ_SOURCE` controls the migration read path:

- `mongo` (default): MongoDB is authoritative and returned to callers.
- `shadow`: MongoDB is returned while the same query is executed against Supabase and compared by stable `mongo_id` plus normalized API fields.
- `supabase`: Supabase is returned after reconciliation and explicit cutover approval.

Do not use `supabase` until the full backfill and reconciliation gates in `plan/migration-mongodb-to-supabase.md` have passed.
