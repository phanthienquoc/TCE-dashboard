# TCE Dashboard — Agent Task Queue

**Last audited:** 2026-10-26  
**Default branch checkpoint:** `master` audited on 2026-10-26. The latest functional/schema merge tracked by this queue is TCE-SEC-001/TCE-RUNTIME-001 at `ccaccb6b6131665e317774dfc8742b480972a316`; subsequent queue-checkpoint commits are documentation-only. Consult Git history for the exact current `master` SHA.  
**Queue convention:** This repository has a mature `plan/` directory but no existing `docs/agentic/` queue. This file follows the current `plan/` convention and supplements, rather than replaces, canonical phase plans/issues.  
**Safety:** No production application release, live orders, or LIVE-mode enablement are part of this queue. This queue records previously authorized, scoped schema work only; it does not authorize future migration applies, Supabase branch creation/merge, production data/schema changes, app releases, or trading actions. The connected project's environment classification remains unverified and its branch metadata reports `MIGRATIONS_FAILED`.

## Queue rules

- Keep IDs stable and update existing entries instead of duplicating them.
- Every task records evidence, current/desired behavior, acceptance, validation, dependencies, risk and source links.
- Check active PRs/branches/issues before creating a new task. Use a dedicated descriptive branch and PR; never commit directly to `master`.
- CI failures are diagnostic. Do not bypass required checks, weaken tests, or submit live orders.
- Treat linked source/docs as repository evidence; verify current code before changing a task's status.

## Priority legend

- **P0** — blocks a critical contract or risks auth/trading correctness.
- **P1** — next dependency-safe engineering task.
- **P2** — important maintenance, UI consolidation or tracking hygiene.

## Active tasks

### TCE-TEST-001 — Restore unit-test discovery in the root test runner

- **Priority/status:** P0 / VALIDATED ON FIX BRANCH — current PR head `702bf36027cd330c14cfeefae7cb224e4297161a` passed exact-head WF-05 [#40277658842](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40277658842) and WF-02 [#40277658919](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40277658919). WF-05 logs confirm 201 Node tests passed plus 23 Vitest files / 99 Vitest tests passed; Prettier read-only check passed. The PR remains open because the Supabase GitHub integration target and migration side effects are not verified safe.
- **Evidence:** In `package.json`, the discovery regex was over-escaped (`/\\\\.(spec|test)\\\\.ts$/`) and matched no normal `.spec.ts` or `.test.ts` filenames. Both runner arrays therefore stayed empty and the test command exited successfully without executing tests. The corrected pattern discovers those files and an explicit zero-discovered-files guard now fails closed.
- **Current behavior before fix:** WF-05 could report success while running no unit tests; backend build still ran separately.
- **Desired behavior:** Discover the intended Node/Vitest test files, run both groups, and fail rather than report success if discovery returns zero files.
- **Acceptance criteria:**
  - [x] Correct the filename matcher for `.spec.ts` and `.test.ts`.
  - [x] Fail the test command when no test files are discovered.
  - [x] Verify backend build and the now-enabled unit-test command on the exact fix-branch head.
  - [x] Verify Prettier on the exact fix-branch head.
  - [ ] Merge to `master` only after the connected Supabase GitHub integration target and push-triggered deployment behavior are confirmed safe.
- **Validation:** Current PR head `702bf36027cd330c14cfeefae7cb224e4297161a` passed exact-head [WF-05 Backend Unit Tests #40277658842](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40277658842): 201 Node tests passed and 23 Vitest files / 99 Vitest tests passed, with no failures/skips; [WF-02 Prettier/auto-format #40277658919](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40277658919) passed the read-only formatting check. Earlier code/test and queue-only validations remain recorded above in commit history. The connected Supabase GitHub integration target and whether a push can apply pending migrations remain unverified; keep this PR open until that external gate is resolved. No workflow was manually dispatched and no schema, production, or trading side effect was performed.
- **Latest side-effect audit (2026-10-26 13:26 +07):** Inspected current workflow triggers and relevant job effects on master. WF-03 production release is workflow_dispatch-only; WF-04 cleanup runs only after a successful WF-03 completion or manual dispatch; WF-08B is path-filtered to microfe/** and its own workflow file, so root package.json does not trigger image publication/promotion. WF-01 matches the root package.json push but only verifies required secret presence, builds local images, and parses Kubernetes YAML; WF-05 and Prettier run checks/formatting. PR #915 changes only package.json and this task queue, with no migration files or workflow files. However, the connected Supabase project's GitHub integration target and whether a push can apply pending migrations remain unverified; the only branch is non-persistent main / Git master with MIGRATIONS_FAILED, and the project-to-repository mapping is unknown. Keep the PR open until that external integration gate is resolved. No workflow was dispatched and no schema, production, or trading side effect was performed.
- **Dependencies:** None for code/test correctness; default-branch merge depends on Supabase integration-target verification.
- **Risk:** P0 test-integrity risk. The connected project ref `gtqovpusfyyvxpeezxlo` lists only `main` / Git `master`, with `is_default=true`, `persistent=false`, and `MIGRATIONS_FAILED`; its project and parent refs are identical and no separate development/preview branch is listed. Treat this base/default branch as production-equivalent until proved otherwise. The connected GitHub repository is not exposed by project metadata. Supabase documentation says connected GitHub commits may run deployment steps and pending migrations, so do not merge this change into the default branch until the target is verified.
- **Links:** [Fix branch](https://github.com/phanthienquoc/TCE-dashboard/tree/fix/tce-test-discovery-20261026), [root test script](../package.json), [WF-05 workflow](../.github/workflows/wf-02-tce-backend-unit-test.yml), [Supabase Branching documentation](https://supabase.com/docs/guides/deployment/branching).

### TCE-SEC-001 — Remove public read and destructive browser grants on position snapshots

- **Priority/status:** P0 / MERGED — source migration `20261026034917_revoke_public_snapshot_access.sql` is on `master` at merge commit `ccaccb6b6131665e317774dfc8742b480972a316`. Post-merge backend unit tests, Build+Verify and the push-format check passed; no production release was dispatched. Non-production end-to-end smoke remains gated on explicit environment classification.
- **Evidence:** Pre-migration `pg_policies` showed `tce_position_snapshots_read` applies to `public` with `USING (true)`. Pre-migration catalog showed `anon` and `authenticated` had SELECT/INSERT/UPDATE/DELETE/TRUNCATE. Source inventory in `phanthienquoc/TCE-dashboard` found the monitor's server-side INSERT as the only direct runtime table consumer; `apps/service/src/db/supabase.client.ts` uses `SUPABASE_SERVICE_ROLE_KEY`. No frontend `@supabase/supabase-js` client, `NEXT_PUBLIC_SUPABASE*`, or direct browser table query was found.
- **Current behavior after migration:** `drop policy if exists tce_position_snapshots_read` removed the public read policy. `revoke all privileges ... from public, anon, authenticated` removed browser/public table access. A read-only post-apply query confirms `anon` and `authenticated` now lack SELECT/INSERT/UPDATE/DELETE/TRUNCATE; `service_role` and `postgres` retain access. `pg_policies` returns no policies on this server-owned table. No snapshot rows were read, updated, or deleted.
- **Desired behavior:** Keep account-scoped position observations server-owned; only NestJS server-role code accesses this table. No browser endpoint should expose full snapshots/signals without explicit authorization and field projection.
- **Acceptance criteria:**
  - [x] Search TCE web/service and related repository paths for direct consumers; document the monitor-only runtime insert and one-time maintenance SQL reference.
  - [x] Remove the unscoped public SELECT policy and direct browser/public privileges through a narrowly scoped source migration.
  - [x] Recheck `pg_policies` and `has_table_privilege` after the migration; confirm no browser/public privilege remains and service-role access remains.
  - [x] Confirm the migration contains no DML against position/account data and no order/engine/LIVE changes.
  - [x] Verify post-merge backend unit tests, Build+Verify and push-format checks on `ccaccb6b6131665e317774dfc8742b480972a316`.
  - [ ] Run end-to-end smoke only against an explicitly identified, approved non-production target; the connected project is not classified as non-production.
- **Validation:** Supabase `apply_migration` succeeded; ledger lists `20261026034917 revoke_public_snapshot_access`. Read-only `has_table_privilege` returned false for anon/authenticated SELECT, INSERT, UPDATE, DELETE and TRUNCATE, while service_role/postgres retained privileges. A separate `pg_policies` query returned no policies. The latest read-only security-advisor result reports 34 project-wide `rls_enabled_no_policy` findings. This is a shared-project count across multiple schemas, not a TCE-only count. The scoped post-apply catalog still confirms no public/browser grants or policies on this server-owned snapshot table; do not add a public policy to silence the advisor.
- **Dependencies:** Current monitor uses the server-side Supabase service-role client. End-to-end service smoke remains part of required CI/integration validation; the app has not been deployed.
- **Risk:** Previously critical exposure is mitigated at the database grant/policy layer. Remaining risk is an untracked external consumer outside the two authorized repositories that expects browser access; the existing source inventory found none.
- **Links:** [applied migration](../supabase/migrations/20261026034917_revoke_public_snapshot_access.sql), [runtime boundary architecture](https://github.com/phanthienquoc/TCE-dashboard/blob/master/docs/architecture/runtime-boundaries.md), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

### TCE-RUNTIME-001 — Durable retry/replay for lifecycle event publication

- **Priority/status:** P1 / MERGED — source migration, enqueue trigger, replay worker and focused tests are on `master` at merge commit `ccaccb6b6131665e317774dfc8742b480972a316`; post-merge backend unit tests, Build+Verify and push-format checks passed. The service image is not deployed.
- **Evidence paths:** `apps/service/src/monitor/tce-monitor.service.ts`, `apps/service/src/monitor/monitor-event.ts`, `apps/service/src/monitor/monitor-event-replay.ts`, `apps/service/src/monitor/monitor-event-replay.spec.ts`, `libs/contracts/src/tce-event.contract.ts`, `libs/db/src/supabase.runtime-event.publisher.ts`, `supabase/migrations/20261026033600_tce_monitor_event_replay_contract.sql`.
- **Current behavior:** Before this slice, monitor snapshot insertion preceded a best-effort event insert with no durable record of publication failure. Live catalog inspection showed `tce_position_snapshots` lacked position/correlation metadata and `tce_runtime_events` did not exist. The connected Supabase migration now creates the event store, stores immutable replay metadata on new monitor snapshots, and atomically enqueues replay rows through an `AFTER INSERT` trigger. The event publisher is still called best-effort; failures are persisted as pending attempts and retried at later monitor runs.
- **Desired behavior:** Preserve the snapshot as the authoritative observation, make event storage durable and replayable after a process restart, use deterministic event IDs and database-level idempotency, bound retries, and expose terminal failures without persisting raw error messages. Never turn a monitor signal into a broker command.
- **Schema change applied:** Project ref `gtqovpusfyyvxpeezxlo`, organization `jopjvkofwvbnxaajkhlo`, Supabase ledger version `20261026033600`. It adds `public.tce_runtime_events`, `public.tce_monitor_event_replay`, nullable `position_id/correlation_id/event_occurred_at` columns to `tce_position_snapshots`, and trigger `trg_tce_monitor_snapshot_enqueue_event`. RLS is enabled on both new tables; no browser/public role has table privileges. After migration `20261026034559`, `service_role` has only SELECT/INSERT on `tce_runtime_events` and SELECT/UPDATE on `tce_monitor_event_replay`; the SECURITY DEFINER enqueue trigger writes the replay row using its owner privileges. A read-only `pg_trigger` query confirmed the trigger is enabled. No positions/orders/config/data rows were read or changed by the migration.
- **Acceptance criteria:**
  - [x] Persist the exact position, account, symbol, signal, event timestamp and correlation needed to reconstruct the monitor event.
  - [x] Create replay metadata in the same DB transaction as the snapshot insert through a trigger; legacy snapshot inserts without the new metadata remain unaffected.
  - [x] Preserve deterministic `monitor.snapshot.created:<snapshot-id>` identity and rely on the event table primary key for idempotent duplicate publication.
  - [x] Record attempt count, next-attempt time, safe error code, successful delivery time, and dead-letter time; backoff is capped at 15 minutes and auto-replay stops after eight attempts.
  - [x] Keep replay-store query failures best-effort so an unavailable replay queue does not block the monitor run.
  - [x] Verify post-merge backend unit tests, Build+Verify and push-format checks on `ccaccb6b6131665e317774dfc8742b480972a316`; these workflows do not expose a separate typecheck step.
  - [ ] Run end-to-end replay smoke only against an explicitly identified, approved non-production target; the connected project is not classified as non-production.
  - [x] Do not modify order dispatch, strategy configuration, positions, cashouts, or LIVE-mode flags; no production app release or live order was initiated.
- **Validation:** Supabase `apply_migration` succeeded for versions `20261026033600 tce_monitor_event_replay_contract` and `20261026034559 tce_monitor_event_least_privilege`. Read-only catalog queries verified the event/replay tables and snapshot metadata columns; `pg_trigger` shows the enqueue trigger enabled; ACL query confirms `service_role` has SELECT/INSERT on `tce_runtime_events` and SELECT/UPDATE on the replay queue, with no public/anon/authenticated grants. Post-merge checks passed on `master` merge commit `ccaccb6b6131665e317774dfc8742b480972a316`: [backend unit tests](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40266723683/job/121390638255), [Build+Verify](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40266723697/job/121390638121), and [push-format check](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40266723701/job/121390638376). WF-03 was not dispatched; the Supabase main branch remains `MIGRATIONS_FAILED` and environment classification is unresolved.
- **Dependencies:** Current monitor/event envelope and existing Supabase publisher. The project branch metadata still reports `MIGRATIONS_FAILED`, but the migration ledger, object catalog and trigger query agree that the applied schema exists; track the status inconsistency rather than treating the apply as failed. The service rollout remains separate and is not performed by this PR.
- **Risk:** Medium. Failure to ship code after schema migration is inert except for the additive objects/columns; once code is deployed, queue write and replay behavior must pass exact-head CI. Dead-letter entries require operator inspection; no automatic broker command is emitted.
- **Sources:** [issue #845](https://github.com/phanthienquoc/TCE-dashboard/issues/845), [implementation tracker #848](https://github.com/phanthienquoc/TCE-dashboard/issues/848), [runtime boundary architecture](https://github.com/phanthienquoc/TCE-dashboard/blob/master/docs/architecture/runtime-boundaries.md), [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md), [base event-store migration](https://github.com/phanthienquoc/TCE-dashboard/blob/master/supabase/migrations/202610210002_tce_runtime_events.sql).

### TCE-RUNTIME-001A — Read-only schema and replay-contract discovery

- **Priority/status:** P1 / DONE — live schema/migration/grant evidence refreshed read-only on 2026-10-26; environment safety remains unresolved.
- **Evidence:** Connected project ref `gtqovpusfyyvxpeezxlo` discovered via `list_projects/get_project`; `list_branches` reports only non-persistent `main` tracking Git `master`, with status `MIGRATIONS_FAILED`. Current migration ledger includes `20261026033600 tce_monitor_event_replay_contract`, but does not include the existing master source migration `202610210002_tce_runtime_events`. It also includes Auth-specific `20261026030920` and `20261026032152` versions that are absent from this TCE repo, plus three older remote-only versions `20261014024759`, `20261014130516`, and `20261014131151`; the live ledger is shared across the TCE and Authentication workspaces.
- **Verified live facts:** `public.tce_position_snapshots` has the three replay metadata columns and an enabled AFTER INSERT trigger `trg_tce_monitor_snapshot_enqueue_event`. `public.tce_runtime_events` and `public.tce_monitor_event_replay` exist with RLS enabled. `enqueue_tce_monitor_snapshot_event()` is `SECURITY DEFINER` with fixed `search_path` and EXECUTE for `postgres`/`service_role`. After migration `20261026034559`, event table privileges for `service_role` are SELECT/INSERT; replay table privileges are SELECT/UPDATE; public/anon/authenticated have none. Pre-hardening all-privileges state is historical and no longer current.
- **Separate P0 security observation (remediated at the DB layer):** The pre-migration public `USING (true)` policy and browser-role SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants were removed by migration `20261026034917_revoke_public_snapshot_access`. Post-apply `pg_policies` is empty for this server-owned table; post-apply `has_table_privilege` confirms anon/authenticated have none of those privileges. See TCE-SEC-001 evidence above.
- **Environment caveat:** Project `ACTIVE_HEALTHY`; the listed non-persistent `main`/Git `master` branch metadata still says `MIGRATIONS_FAILED`, despite four successful owner-directed scoped migrations and catalog verification. This remains a metadata/integration reconciliation task, not evidence that those observed migrations failed. Repo placeholders do not identify the connected project as production vs preview; app releases remain separate.
- **Actions in the initial discovery audit:** That checkpoint was read-only. Later scoped TCE schema/grant migrations were applied and verified under TCE-RUNTIME-001 and TCE-SEC-001. No Supabase branch operation, application deployment, live order, or trading-mode change was performed.
- **Sources:** [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md), [replay schema migration](../supabase/migrations/20261026033600_tce_monitor_event_replay_contract.sql), [least-privilege replay grants](../supabase/migrations/20261026034559_tce_monitor_event_least_privilege.sql), [snapshot access revocation](../supabase/migrations/20261026034917_revoke_public_snapshot_access.sql), [Supabase branching docs](https://supabase.com/docs/guides/deployment/branching).

### TCE-PLAN-001 — Reconcile stale runtime-plan frontier and exact-head evidence

- **Priority/status:** P2 / DONE — follow-up stale PR #865 checkpoint reconciled on 2026-10-26.
- **Evidence:** `plan/runtime-contract-standardization.md`, `docs/architecture/runtime-boundaries.md`, and this queue. GitHub confirms [PR #865](https://github.com/phanthienquoc/TCE-dashboard/pull/865) is merged at `d4ff9a4ae469e8c4124927e11d13046ef6ec77fd`, from exact head `5f865d751dbfa695c8439f8a5a21d836274deb46`.
- **Current behavior:** The runtime plan retained a stale checkpoint saying PR #865 was open, its latest head had no CI runs, and merge was prohibited; it also repeated the completed identity-matching task as the current task.
- **Desired behavior:** Keep one authoritative current frontier. PR #865's identity ambiguity task is historical/completed; durable lifecycle-event retry/replay is now implemented in the active PR against the applied additive replay contract. Exact-head CI and separately authorized application rollout remain outstanding.
- **Acceptance criteria:**
  - [x] Remove stale open-PR/no-CI claims for PR #865 and preserve the completed exact-head evidence.
  - [x] Retire the duplicate unchecked task block without deleting the completed PR history.
  - [x] Preserve the TCE-RUNTIME-001 applied-schema/source-sync evidence and LIVE-trading safety boundary; application release remains a separate gate.
- **Validation:** Exact-head backend build/unit tests passed [run #39539207470](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39539207470); Prettier passed [run #39539207463](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39539207463). Current `master` was verified at `32b0c45b1fe2fb79aaa8c68b73d4240ab41546d0`; WF-03 remains `workflow_dispatch`-only. No production workflow was dispatched.
- **Dependencies:** None for documentation. TCE-RUNTIME-001's schema contract is applied; exact-head CI and separately authorized application rollout remain outstanding.
- **Risk:** Low; stale task status can cause duplicate work or false completion claims.
- **Links:** [PR #865](https://github.com/phanthienquoc/TCE-dashboard/pull/865), [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md), [PR #907](https://github.com/phanthienquoc/TCE-dashboard/pull/907).

### TCE-PLAN-002 — Synchronize runtime standardization issue with phase evidence

- **Priority/status:** P2 / DONE — issue #848's stale unchecked Phase 2–4 boxes were reconciled on 2026-10-26; implementation is merged while environment-dependent rollout gates remain open.
- **Evidence:** `plan/runtime-contract-standardization.md` Phase 2–4; `apps/service/src/monitor/tce-monitor.service.ts`; `apps/service/src/runtime-events/runtime-events.controller.ts`; `apps/service/src/runtime-events/runtime-events.websocket.ts`; `libs/contracts/src/tce-event.contract.ts`; `libs/contracts/src/tce-idempotency.contract.ts`. PR #853 merged at `1040823b4281b21f6057ce4015b6a80ca3bced74`; idempotency foundation PR #851 merged at `caa64bd4ebaf2cc99b966c2cfe606bfcbf8f689d`; failure-path follow-ups #868/#870/#871/#872 are recorded in the canonical plan.
- **Current behavior:** Issue #848 still showed Phase 2–4 unchecked even though the plan and current source/tests record those implementations as complete. Phase 5 remains incomplete, and environment-dependent activation/rollout is still gated.
- **Desired behavior:** Keep the issue tracker aligned with the canonical phase plan without claiming staging verification or production rollout that has not occurred.
- **Acceptance criteria:**
  - [x] Mark Phase 2 runtime ownership/event emission complete using merged source and tests.
  - [x] Mark Phase 3 REST/SSE/WebSocket contract work complete with PR #853 evidence.
  - [x] Mark Phase 4 implementation/failure-path coverage complete while keeping durable-store activation blocked pending approved non-production verification.
  - [x] Leave Phase 5 rollout and deployment verification open until an approved non-production target is confirmed.
  - [x] Verify WF-03 is manual-dispatch-only; do not dispatch it or enable LIVE trading.
- **Validation:** Read-only source/plan/merge-history inspection; the live connected Supabase environment remains unclassified and reports `MIGRATIONS_FAILED`. No code or SQL changed, no database operation was run, and no production release or live order was triggered.
- **Dependencies:** Explicit non-production environment classification; required migration state and staging integration checks before enabling the durable-store flag. Production rollout remains separately gated.
- **Risk:** Low documentation-only change. Stale tracker status could cause duplicate work or falsely imply that rollout checks passed.
- **Links:** [Issue #848](https://github.com/phanthienquoc/TCE-dashboard/issues/848), [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md), [PR #853](https://github.com/phanthienquoc/TCE-dashboard/pull/853), [PR #851](https://github.com/phanthienquoc/TCE-dashboard/pull/851).

### TCE-UI-001 — Consolidate overlapping mobile-landscape PRs

- **Priority/status:** P2 / DONE — [PR #892](https://github.com/phanthienquoc/TCE-dashboard/pull/892) squash-merged at `6cc92f4613b0876cb769d521db3a1b474052e346`; current `master` was verified at that exact SHA.
- **Implementation branch:** `feat/tce-ui-001-consolidated-landscape`.
- **Exact tested PR HEAD:** `6ef387770e2960b91e392cdfc05dafa4a91372d5`.
- **Validation:** WF-11 Chromium viewport contract [#40227169492](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227169492), WF-02 Prettier [#40227169540](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227169540), and WF-05 backend tests [#40227169464](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227169464) all passed on the exact tested head.
- **Visual review:** Inspected Chromium screenshots from the successful viewport run for 390×844 portrait, 844×430 landscape, 844×390 short landscape, and 1280×800 desktop. Seven actual navigation links now fit in one row; landscape header text is legible; the short-landscape dock fits its items. The desktop screenshot uses mocked data and skeleton placeholders; no production-data/preview visual pass is claimed.
- **Root causes fixed:** The real dashboard rendered seven links while the CSS/fixture expected six; the landscape media query did not inherit the shared mobile palette; and the 42px short-landscape dock was too short for tab content. The final implementation uses seven columns, applies shared mobile styles to the bounded landscape media query, and constrains short-landscape tab height/line-height within a 44px dock.
- **Evidence paths:** `apps/web/app/mobile-command-center.css`, `apps/web/app/mobile-design-system.css`, `apps/web/components/dashboard/DividendPositionsView.tsx`, `apps/web/scripts/mobile-landscape-viewport.test.mjs`, and `apps/web/scripts/mobile-landscape-app.test.mjs`.
- **Post-merge validation:** WF-01 build/verify [#40227321159](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227321159), WF-02 [#40227321175](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227321175), and WF-05 [#40227321165](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227321165) all passed on merge SHA `6cc92f4613b0876cb769d521db3a1b474052e346`. Plan-evidence PR #897 merged at `af7ebdf9f9512fa133c7cc87226e55c76b80e690`; post-merge WF-02 [#40227611007](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227611007) and WF-05 [#40227611004](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227611004) passed.
- **Merge safety:** WF-03 remains `workflow_dispatch`-only; no WF-03 run was created. The matching WF-01 push workflow builds/verifies images and production-config presence but does not publish or deploy; WF-08B's path filters do not match. No production migration, deployment, LIVE trading or order action.
- **Supersession:** PRs #809, #810 and #811 were closed as superseded after verifying their key landscape/positions-HUD selectors and component class exist in merged `master`.

### TCE-UI-002 — Align desktop positions-HUD header and live status

- **Priority/status:** P2 / DONE — [PR #898](https://github.com/phanthienquoc/TCE-dashboard/pull/898) squash-merged at `c716e51b0c2161fd8ac9d4e8e5d376fa50c0031d`; current `master` verified at that SHA.
- **Current behavior:** At desktop widths, the positions header inherits no flex layout because shared mobile styles are bounded to portrait/mobile-landscape. The title and subtitle render inline as `PositionsLive exposure`, and the LIVE status renders as plain text.
- **Desired behavior:** At widths ≥951px, align the header title/subtitle as a stacked brand block, keep the LIVE status as a distinct readable pill, and preserve existing mobile/landscape styling.
- **Acceptance criteria:** Add a desktop-only style block scoped to `.tce-position-hud`; test the running local `/position` route at 1280×800 for flex header, separate subtitle, visible title and pill display; verify 390×844, 844×430 and 844×390 behavior remains unchanged. No data/schema/trading changes.
- **Merge evidence:** Exact tested PR HEAD `67db3e1575a0c266eb4a1d9b0d916abf5710708a`. WF-11 Chromium viewport contract [#40227941665](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941665), WF-02 Prettier [#40227941870](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941870), and WF-05 backend unit tests [#40227941735](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941735) all passed on the exact tested head. The inspected merge diff changed only scoped HUD CSS, browser assertions, and this task queue; no API, schema, trading, or order behavior changed.
- **Validation:** WF-11 browser contract [#40227941665](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941665), WF-02 Prettier [#40227941870](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941870), and WF-05 backend tests [#40227941735](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40227941735) passed on exact PR HEAD. The desktop screenshot artifact was reviewed in the successful run. Post-merge master checks on `0a257f05b1a1fbe241667ba4e9e5c9730991d873` passed WF-02 [#40228496991](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40228496991) and WF-05 [#40228497054](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40228497054). Duplicate formatter/backend jobs [#40228582895](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40228582895) and [#40228582888](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40228582888) were cancelled; no WF-01 run matched the documentation-only path. WF-03 remains manual-dispatch-only, so no production release/promotion was triggered.
- **Validation note:** The first desktop run on head `43dfa14c82bb38757d39602b5a542270f14932c2` failed only because the test expected computed `display: inline-flex`. Since the badge is a flex item, browsers blockify that to computed `flex`; the test now accepts either flex display and asserts the actual background, border and 999px radius instead of overfitting a CSS display keyword.
- **Dependencies:** None; independent of TCE-RUNTIME-001's blocked Supabase schema work.
- **Risk:** Low — desktop-only CSS scoped to the positions HUD.
- **Safety:** No production migration/deployment, LIVE trading, orders or platform-infra changes.

### TCE-UI-003 — Compact Pools mobile layout and safe-area spacing

- **Priority/status:** P2 / DONE — [PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906) squash-merged at `deeedfe704b3c1cfe522768d15fd13f4e79df6ea`; `master` verified at the merge SHA.
- **Evidence:** [diagnostic PR #905](https://github.com/phanthienquoc/TCE-dashboard/pull/905), [fix PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906), [WF-11 root-cause run #40255671708](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40255671708), and [follow-up run #40255940553](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40255940553).
- **Current behavior:** The merged page-scoped CSS explicitly restores `display: grid` for both Pools balance and Active Rotation KPI grids in the 600–950px landscape range. Real Chromium confirms two KPI columns at 844×430 and 844×390, three pool columns in landscape, and two pool columns at 390×844; the third KPI wraps to row two.
- **Desired behavior:** Keep Active Rotation metrics in two columns, with the third metric on the next row; show all three capital pools within the viewport; prevent horizontal overflow and preserve safe-area/bottom-dock spacing.
- **Acceptance criteria:**
  - [x] Correct the proven cascade/selector cause without broadening unrelated page styles, using diagnostics from TCE-UI-003A.
  - [x] WF-11 passes at 390×844, 844×430 and 844×390; inspect the generated screenshots for the same viewports.
  - [x] No capital-allocation, API, schema, authentication or trading behavior changes.
- **Validation:** Superseded attempts #902 and #905 were closed. PR #906 exact head `b831fe274d394e8e892aab4c79dab7eea8ce150b` passed Chromium viewport contract [run #40256640973](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256640973), backend unit tests [run #40256640970](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256640970), and Prettier [run #40256640985](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256640985). Post-merge checks on `deeedfe704b3c1cfe522768d15fd13f4e79df6ea` passed build/verify [run #40256743522](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256743522) and backend tests [run #40256743579](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256743579). WF-03 remains manual-dispatch-only; no release was dispatched.
- **Dependencies:** TCE-UI-003A diagnostics are complete and the dependency is satisfied. Existing production-release workflow WF-03 is `workflow_dispatch`-only; ordinary master pushes do not trigger its publish/promotion jobs.
- **Risk:** Low UI regression risk; page-scoped CSS and browser assertions only. No runtime/trading behavior change intended.
- **Links:** [merged PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906), [issue #433](https://github.com/phanthienquoc/TCE-dashboard/issues/433), [WF-11 success](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256640973).

### TCE-UI-003A — Diagnose Pools rotation KPI CSS cascade in real Chromium

- **Priority/status:** P1 / DONE — root-cause evidence is complete and all three viewport screenshots were uploaded by WF-11 run #40256118218.
- **Implementation branch:** `feat/tce-ui-003a-pools-cascade-diagnostics-v2-20261026`. The browser harness records computed grid styles for scoped/unscoped KPI elements, media-query state, CDP matched declarations, stylesheet URLs/source locations, and screenshots before assertions; the two-column assertion remains enabled.
- **Evidence:** [diagnostic PR #905](https://github.com/phanthienquoc/TCE-dashboard/pull/905), [fix PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906), [root-cause run #40255671708](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40255671708), and [successful diagnostic/artifact run #40256118218](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256118218).
- **Current behavior / evidence:** WF-11 run #40256118218 emitted structured CDP diagnostics for all three viewports, passed geometry assertions and uploaded 11 files including `artifacts/pools-mobile/*.png`. The exact-head follow-up was completed in PR #906.
- **Desired behavior:** Capture enough real-browser evidence at 844×430 to identify the winning `grid-template-columns` declaration and its selector/media query before changing CSS.
- **Acceptance criteria:**
  - [x] Emit a structured diagnostic before assertions: viewport and DPR, target element/ancestor classes, computed `grid-template-columns`, and `matchMedia` results for the 600–950px and mobile-width queries.
  - [x] Use the existing Chromium DevTools Protocol session to record matched CSS rules/declarations for `grid-template-columns` on the actual Active Rotation KPI element; include stylesheet URL and source order where available.
  - [x] Preserve the failing two-column assertion; do not weaken or skip it.
  - [x] Upload the Pools screenshots to the workflow artifact and verify 390×844, 844×430 and 844×390 artifacts on WF-11 run #40256118218 (11 artifact files).
  - [x] No new dependency, CSS fix, API/schema/auth change, capital-allocation change or trading/order behavior change in this diagnostic slice.
- **Validation:** WF-11 run #40256118218 emitted structured CDP diagnostics for all three viewports and uploaded 11 screenshot/artifact files. PR #906 then fixed the two page-scoped grid declarations and passed all three viewport assertions on its exact head.
- **Dependencies:** Existing TCE-UI-003/PR #902 test contract. No Supabase schema or production environment dependency.
- **Risk:** Low — test-only diagnostics; avoid logging credentials or real account data.
- **Links:** [PR #902](https://github.com/phanthienquoc/TCE-dashboard/pull/902), [issue #433](https://github.com/phanthienquoc/TCE-dashboard/issues/433), [WF-11 failure](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40234416071).

### TCE-UI-003B — Restore Pools KPI grid display in short landscape

- **Priority/status:** P1 / DONE — implemented in [PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906), squash-merged at `deeedfe704b3c1cfe522768d15fd13f4e79df6ea`.
- **Evidence:** [root-cause run #40255671708](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40255671708), [successful viewport run #40256118218](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256118218), [diagnostic PR #905](https://github.com/phanthienquoc/TCE-dashboard/pull/905), and [fix PR #906](https://github.com/phanthienquoc/TCE-dashboard/pull/906).
- **Current behavior:** WF-11 run #40256118218 passed all three viewports: portrait 390×844 reports two rendered pool columns and two KPI columns; 844×430 and 844×390 report three pool columns and two KPI columns, with the third KPI on row two. Both grids compute `display: grid`, the landscape media query matches, and 11 artifact files were uploaded. The subsequent Prettier formatter commit was followed by successful exact-code checks; this queue update changes documentation only.
- **Desired behavior:** Apply display:grid to both page-scoped Pools balance and Active Rotation KPI grids within the 600–950px media query and verify actual child geometry rather than counting tokens in the computed grid-template string.
- **Acceptance criteria:**
  - [x] Active Rotation KPI grid is display:grid and visibly has two columns at 844×430; the third metric wraps to row two.
  - [x] Capital Pools balance grid is display:grid and visibly has three columns at 844×430 and 844×390.
  - [x] Portrait 390×844 and short landscape 844×390 remain correct; all three screenshots are captured even if one viewport assertion fails.
  - [x] Pool-column assertions use rendered child positions, not whitespace parsing of CSS declarations.
  - [x] WF-02, WF-05 and WF-11 passed on the exact PR head `b831fe274d394e8e892aab4c79dab7eea8ce150b` before merge; post-merge build/verify and backend tests passed on the merge SHA.
  - [x] No unrelated layout, capital-allocation, API, schema, auth, order or LIVE-mode behavior changes.
- **Validation:** PR #906 exact head `b831fe274d394e8e892aab4c79dab7eea8ce150b` passed WF-02 run #40256640985, WF-05 run #40256640970, and WF-11 run #40256640973. WF-11 uploaded 11 artifacts including all Pools screenshots. Post-merge build/verify [#40256743522](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256743522) and backend tests [#40256743579](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40256743579) passed on `deeedfe704b3c1cfe522768d15fd13f4e79df6ea`.
- **Dependencies:** TCE-UI-003A diagnostics; no schema or service dependency.
- **Risk:** Low UI regression risk; page-scoped CSS and test assertions only.
- **Links:** [diagnostic PR #905](https://github.com/phanthienquoc/TCE-dashboard/pull/905), [blocked parent PR #902](https://github.com/phanthienquoc/TCE-dashboard/pull/902), [WF-11 evidence](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40255671708).

### TCE-OPS-002 — Make destructive legacy workflow cleanup manual-only

- **Priority/status:** P1 / DONE on 2026-10-25 — [PR #895](https://github.com/phanthienquoc/TCE-dashboard/pull/895) squash-merged at `03f564e76d5a4c368c1db924ebb8d61f5f1bae9b`; `master` verified at the same SHA.
- **Evidence paths:** `.github/workflows/wf-00-tce-legacy-actions-cleanup.yml`, `.github/workflows/wf-01-tce-build-verify.yml`, `.github/workflows/wf-03-tce-production-deploy.yml`.
- **Current behavior/evidence:** Before PR #895, WF-00 triggered on every push to `master`, granted `actions: write`, enumerated repository workflow runs, and deleted every run whose name did not start with `WF-`. PR #895 removed that push trigger; WF-00 now runs only on explicit `workflow_dispatch`.
- **Desired behavior:** Keep the cleanup operation available only through explicit `workflow_dispatch`; ordinary merges must not delete workflow history.
- **Acceptance criteria:** WF-00 has no push or workflow-run trigger; the manual-dispatch job remains intact; workflow validation and PR CI pass; merging this trigger-only change does not invoke WF-00, WF-03 or production promotion.
- **Tests/validation:** Exact-head checks passed: [WF-02 #40224885796](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224885796) and [WF-05 #40224885833](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224885833); push checks [#40224807344](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224807344) and [#40224807333](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224807333) also passed. Post-merge WF-01 [#40224993887](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224993887), WF-02 [#40224993872](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224993872), and WF-05 [#40224993834](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224993834) passed on merge SHA `03f564e76d5a4c368c1db924ebb8d61f5f1bae9b`. No WF-00 or WF-03 run was observed for that merge SHA.
- **Dependencies:** None.
- **Risk:** Medium — automatic cleanup stops; an operator must explicitly dispatch it when cleanup is intended. Manual execution remains destructive and must not be part of normal implementation runs.
- **Sources:** [WF-00 workflow](https://github.com/phanthienquoc/TCE-dashboard/blob/master/.github/workflows/wf-00-tce-legacy-actions-cleanup.yml), [PR #894](https://github.com/phanthienquoc/TCE-dashboard/pull/894), [PR #892](https://github.com/phanthienquoc/TCE-dashboard/pull/892).

## Completed / resolved audit items

### TCE-OPS-001 — Require explicit manual production release dispatch

- **Priority/status:** P0 / DONE on 2026-10-25.
- **Evidence:** PR #888 merged at `f301c1b633af307ad07940d576d8c123f5698bfb` from exact tested head `aa309ae4bc6a1024b3ebc8d06503c589b96bc873`; PR #889 merged at `a47cc1063354abd2ea58219dd5af570a0a5e2b4a` from exact tested head `00f2c0ac8b6bc51958c01ec3a129e6157acd4c93`. WF-05 and WF-02 passed on both exact PR heads.
- **Current/desired behavior:** WF-03 previously ran on every `master` push and could publish ARM64 images and dispatch platform-infra promotion. WF-03 now has only `workflow_dispatch`; ordinary PR merges cannot start production release/promotion.
- **Acceptance:** Preserve the image/tag/promotion contract, keep release initiation explicit and auditable, and ensure the workflow-only merges cannot match a push trigger.
- **Validation:** Reviewed the complete WF-03 downstream job graph and related triggers. Current `master` verified at `a47cc1063354abd2ea58219dd5af570a0a5e2b4a`; no WF-03 run was observed for the merge SHA. WF-01 build verification and WF-00 cleanup were observed separately; neither publishes/promotes production images.
- **Risk:** High if manually dispatched without release authorization; do not dispatch as part of implementation work.
- **Sources:** [issue #887](https://github.com/phanthienquoc/TCE-dashboard/issues/887), [PR #888](https://github.com/phanthienquoc/TCE-dashboard/pull/888), [PR #889](https://github.com/phanthienquoc/TCE-dashboard/pull/889), historical [WF-03 run #40209684600](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40209684600).

### TCE-TRACK-001 — Deduplicate runtime-standardization issue tracker

- **Priority/status:** P2 / DONE on 2026-10-25.
- **Evidence paths:** GitHub issue metadata for #845, #848 and #849.
- **Current vs desired:** #848 and #849 had identical title, goal, workflow policy, acceptance checklist and original context. #849 was closed with reason `duplicate`; #848 remains the single active implementation tracker and #845 remains the architecture umbrella.
- **Acceptance criteria:** Only one active copy of the same implementation checklist remains; canonical issue links are preserved.
- **Tests/validation:** Re-read issue state after the update; #849 is closed as duplicate of #848.
- **Dependencies:** None.
- **Risk:** Low; avoids split or duplicated implementation state.
- **Sources:** [architecture issue #845](https://github.com/phanthienquoc/TCE-dashboard/issues/845), [canonical tracker #848](https://github.com/phanthienquoc/TCE-dashboard/issues/848), [closed duplicate #849](https://github.com/phanthienquoc/TCE-dashboard/issues/849).

### TCE-CI-001 — Prevent Prettier push/PR workflow races

- **Priority/status:** P1 / DONE on 2026-10-25 — [PR #894](https://github.com/phanthienquoc/TCE-dashboard/pull/894) squash-merged at `abcf02dbca072a19816021eca9faff07a0e65d35`; `master` verified at the same SHA.
- **Evidence paths:** `.github/workflows/wf-02-tce-prettier-format.yml`, `plan/agentic-task-queue.md`.
- **Current behavior/evidence:** Before PR #894, run [#40224363153](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224363153) completed Prettier formatting, then failed at the formatter bot's `git push` with `[rejected] (fetch first)`. Both `push` and `pull_request` ran a write-and-push job under different concurrency groups. After PR #894, PR events run read-only `prettier --check`; only push/manual-dispatch events can write formatting commits.
- **Desired behavior:** Pull-request runs perform a read-only `prettier --check` with `contents: read`; push/manual runs alone may format and commit with `contents: write`. Concurrency groups are event-specific. Never force-push or let a PR check mutate its head branch.
- **Acceptance criteria:** The PR check retains the existing `Prettier auto-format & commit` check name; PR events contain no git-push step; push/dispatch formatting succeeds on the current head; no concurrent formatter push rejection remains; exact-head Prettier and backend checks pass.
- **Tests/validation:** Exact-head PR checks passed on `93584c2891d6c948e5b30a3da9ee48d3088ad066`: [WF-02 #40225035537](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225035537) and [WF-05 #40225035542](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225035542). Post-merge checks passed on `abcf02dbca072a19816021eca9faff07a0e65d35`: [WF-02 #40225107201](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225107201), [WF-05 #40225107197](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225107197), and [WF-01 build verification #40225107209](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225107209). PR events have no push step; no force-push was used.
- **Dependencies:** None.
- **Risk:** Low; workflow-only behavior change. PR runs lose write permission, and automatic formatting remains available on push/dispatch.
- **Sources:** [failed formatter job logs](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224363153), [canonical UI PR #892](https://github.com/phanthienquoc/TCE-dashboard/pull/892), [prior race evidence](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567566629).

## Audit snapshot

- **Open PRs:** #809, #810, #811; all are stale and overlap in the same stylesheet. Their current heads had no check-runs in the audited GitHub endpoint; this is a validation gap, not proof that the code fails.
- **Open runtime issues:** #845 (architecture umbrella) and #848 (implementation tracker). Exact duplicate #849 is closed.
- **Recent workflow state:** scheduled healthcheck, integration-check and backup runs audited on 2026-10-24/25 are green. Historical 2026-10-21 formatter failure is classified above.
- **Next implementation task:** TCE-RUNTIME-001 durable retry/replay for lifecycle-event publication. Continue independently of auth user-management work; do not touch repositories outside this queue's scope.
