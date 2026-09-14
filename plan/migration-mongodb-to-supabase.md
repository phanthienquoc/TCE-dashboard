# MongoDB → Supabase Migration

## Tracking

- GitHub: #573
- Current slice: `vietstock.events`
- Branch: `task/573-mongodb-supabase-migration-events`
- Mongo source: Atlas `Project 0` / `Cluster0` / `vietstock.events`
- Supabase target: `public.stock_events`
- Source baseline: 11,491 documents (2026-09-14)
- Cutover: **not started**
- Mongo source remains authoritative during migration.

## Phase 0 — Baseline

- [x] Identify Mongo Atlas project/cluster/database/collection.
- [x] Record source document count: 11,491.
- [x] Inspect source schema and indexes.
- [x] Confirm TCE currently reads stock events through Mongo-backed `stock-events` service.
- [x] Confirm Supabase PostgreSQL 17 target project.
- [ ] Complete repository-wide Mongo read/write ownership inventory.
- [ ] Complete canonical ID/idempotency mapping for all future domains.

## Phase 1 — Schema mapping: `vietstock.events`

Target table: `public.stock_events`.

Normalized fields:

- `mongo_id` — stable source ObjectId string, unique/idempotency key.
- `symbol` — normalized from `symbol` / `Mã CK`.
- `exchange` — from `Sàn`.
- `ex_right_date` — parsed `Ngày GDKHQ`.
- `record_date` — parsed `Ngày ĐKCC`.
- `payment_date` — parsed `Ngày thực hiện`.
- `event_content` — from `Nội dung sự kiện`.
- `ratio_text` — from `Tỷ lệ`.
- `dividend_value` — from `dividendValue`.
- `reference_price` — from `price`.
- `gdkhq_timestamp` — source timestamp.
- `crawled_at`, `synced_at` — source timestamps.
- `raw_data` — original source payload for forward compatibility/audit.

Indexes:

- `(symbol, gdkhq_timestamp desc)`
- `ex_right_date`
- `exchange`

Security:

- RLS enabled before any public/API exposure.
- No public/authenticated policies are added in this slice until the TCE read access contract is defined.

## Phase 2 — ETL tooling

- [ ] Add repeatable, batched Mongo → Postgres migration command.
- [ ] Transform BSON ObjectId/Date/Number values deterministically.
- [ ] Upsert by `mongo_id`; migration must be rerunnable.
- [ ] Preserve raw source payload.
- [ ] Add count/date-range/symbol/aggregate/sample validation.

## Phase 3 — Backfill

- [ ] Backfill small sample first.
- [ ] Validate sample against Mongo.
- [ ] Full backfill 11,491+ documents.
- [ ] Re-run source count and target count checks.
- [ ] Validate event-date and symbol coverage.

## Phase 4 — Dual-read

- [ ] Add repository abstraction/feature flag.
- [ ] Read from Mongo and Supabase side-by-side in shadow mode.
- [ ] Compare result sets for representative TCE queries.
- [ ] Confirm no material drift before cutover.

## Phase 5 — Cutover

- [ ] Freeze source writes for the final delta if needed.
- [ ] Apply final delta.
- [ ] Verify zero/acceptable drift.
- [ ] Switch TCE reads to Supabase.
- [ ] Monitor errors, latency and freshness.

## Phase 6 — Decommission

- [ ] Remove Mongo stock-event runtime dependency.
- [ ] Keep Mongo read-only retention/backups for rollback window.
- [ ] Only remove `mongodb` dependency after repository-wide inventory confirms no remaining runtime dependency.

## Safety rules

- No destructive Mongo operations during migration.
- No live order submission/mutation as part of migration work.
- Keep migration idempotent.
- Do not commit secrets.
- Follow TCE Git flow: dedicated branch → tests → one clean commit → PR → squash merge.
