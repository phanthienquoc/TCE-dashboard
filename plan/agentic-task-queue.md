# TCE Dashboard — Agent Task Queue

**Last audited:** 2026-10-26  
**Default branch snapshot:** `master` at `61ccdaabb14a5d18b7e2722edadd1ec9162603ce` when TCE-UI-001 was revalidated  
**Queue convention:** This repository has a mature `plan/` directory but no existing `docs/agentic/` queue. This file follows the current `plan/` convention and supplements, rather than replaces, canonical phase plans/issues.  
**Safety:** No production changes, migrations, live orders, or LIVE-mode enablement are part of this queue.

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

### TCE-RUNTIME-001 — Durable retry/replay for lifecycle event publication

- **Priority/status:** P1 / BLOCKED on approved non-production validation and replay-complete snapshot metadata (read-only live catalog evidence recorded 2026-10-25).
- **Evidence paths:** `apps/service/src/monitor/tce-monitor.service.ts`, `apps/service/src/monitor/monitor-event.ts`, `apps/service/src/monitor/monitor-event.spec.ts`, `libs/contracts/src/tce-event.contract.ts`, `plan/runtime-contract-standardization.md`.
- **Current behavior:** Monitor persists a position snapshot, then calls `publishMonitorSnapshotBestEffort`. On publisher failure it logs a warning and continues; there is no durable replay record. Read-only live catalog inspection on 2026-10-25 found `public.tce_position_snapshots` has no `position_id` or `correlation_id`, and `public.tce_runtime_events` is absent; migration `202610210002_tce_runtime_events` is not in the remote migration ledger. A snapshot alone therefore cannot currently reconstruct the exact event payload after process restart.
- **Desired behavior:** Keep snapshot/audit behavior authoritative while making event publication durably retryable/replayable with stable event identity, correlation and account scope. Never turn a monitor signal into a broker command.
- **Acceptance criteria:**
  - Failed publication remains durably discoverable and is retried/replayed after process restart.
  - Stable `eventId` is preserved; duplicate delivery is idempotent at consumers.
  - Retry/backoff, terminal failure/dead-letter or operator visibility are explicit; no blind retry of unknown broker outcomes.
  - Existing snapshot, audit and cashout behavior is unchanged; no LIVE order dispatch is added.
  - Any schema change is additive and tested in a non-production environment before rollout.
- **Tests/validation:** Inject publisher/database failures; prove replay after restart; test duplicate event delivery, ordering/correlation and retry limits; run focused monitor/runtime-event tests, backend unit tests, typecheck, build and Prettier on the exact PR head.
- **Dependencies:** Existing `TceEventEnvelope`/publisher port and monitor event tests are present. The only connected Supabase development branch is non-persistent `main` with status `MIGRATIONS_FAILED` (preview status `ACTIVE_HEALTHY`); no approved healthy non-production schema environment is available for this validation. Do not apply the migration to production.
- **Risk:** Medium/high; lost lifecycle events can create gaps between persisted snapshots and downstream consumers.
- **Sources:** [issue #845](https://github.com/phanthienquoc/TCE-dashboard/issues/845), [canonical implementation tracker #848](https://github.com/phanthienquoc/TCE-dashboard/issues/848), [runtime boundary architecture](https://github.com/phanthienquoc/TCE-dashboard/blob/master/docs/architecture/runtime-boundaries.md), [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md), [monitor publisher](https://github.com/phanthienquoc/TCE-dashboard/blob/master/apps/service/src/monitor/monitor-event.ts).

### TCE-RUNTIME-001A — Read-only schema and replay-contract discovery

- **Priority/status:** P1 / DONE — evidence slice only; no runtime or database changes.
- **Evidence:** Connected Supabase project catalog and migration ledger, inspected read-only on 2026-10-25; source files `apps/service/src/monitor/tce-monitor.service.ts`, `apps/service/src/monitor/monitor-event.ts`, and `supabase/migrations/202610210002_tce_runtime_events.sql`.
- **Verified live facts:** `public.tce_position_snapshots` has `id`, `account_id`, `symbol`, `observed_at`, `signal`, `signal_reason`, `t_plus`, `is_market_hours`, `created_at` and other observation fields, but no `position_id` or `correlation_id`. `public.tce_runtime_events` is absent from the live catalog. The remote migration ledger ends at `20261020234922 keycloak_identity_persistence`; it does not include `202610210002_tce_runtime_events`.
- **Implication:** Current snapshots do not carry enough persisted identity to reconstruct the exact `monitor.snapshot.created` event after a process restart. Reusing the checked-in migration without additional replay metadata would not by itself satisfy durable replay.
- **Next step:** Obtain an approved non-production Supabase environment and validate an additive contract that persists the position/correlation identity and records bounded delivery state, retry timing and terminal/dead-letter visibility, or prove an atomic snapshot+outbox transaction. Validate concurrent claim/idempotency behavior before enabling a worker.
- **CI checkpoint:** Initial PR head `8f60d08eb711e2f9b68b797446d9ee28e8e60433` had Prettier run [#40214472194](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214472194) format successfully but fail at the commit push with a non-fast-forward rejection because a concurrent formatter run was updating the same branch. The alternate formatter run [#40214482490](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214482490) succeeded and produced formatted head `0ec80cd3460d941308c6e183d538d04c23b01ca0`. The formatter commit used `[skip ci]`; the plan-evidence head `2f1f4a051cc5544aceaebbbc48281648e4f6d226` therefore does not validate the latest formatted head. A second pair of formatter runs on that head reproduced the concurrent-push race: [#40214654730](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214654730) failed at push while [#40214659364](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214659364) successfully pushed formatting-only head `1bb513a98fde1bc4d98b33e449c40b58666cf259`. This evidence update triggers the required checks on the resulting head; do not merge until those exact-head checks are green.
- **Safety:** Catalog and migration reads only; no SQL writes, migrations, deployments, platform-infra access, LIVE-mode changes or orders.

### TCE-PLAN-001 — Reconcile stale runtime-plan frontier and exact-head evidence

- **Priority/status:** P2 / DONE on 2026-10-25.
- **Evidence paths:** `plan/runtime-contract-standardization.md`, `docs/architecture/runtime-boundaries.md`, `plan/agentic-task-queue.md`.
- **Verified evidence:** PR #884 merged at `e3e1e06731fa1dcb4d5703e5dd562509eb16a3df` from tested head `585172e3166994da4b1e026b0cfb38c7ee5270ea`. PR #885 merged at `5b6f4e94d5b940c83f7f534d57e3d49590d7e013` from tested head `016cbd2083a6853a07159ef980be2ba708f54b37`; [WF-05 #2107](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567687431) and [WF-02 #1559](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567687358) passed on that exact head.
- **Result:** The stale verify/merge checklist is reconciled; durable lifecycle-event replay remains the next implementation task. Issue #887's production-trigger gate is also resolved by PRs #888/#889 and recorded in the runtime plan.
- **Validation:** Re-read merged PR metadata, exact-head check runs, current `master` SHA and the manual-only WF-03 trigger. No production workflow ran for the workflow-only merge SHA.
- **Dependencies:** None for documentation; TCE-RUNTIME-001 still requires an additive schema design and non-production validation before any migration rollout.
- **Risk:** Low; stale status can cause duplicate work or false completion claims.
- **Sources:** [PR #884](https://github.com/phanthienquoc/TCE-dashboard/pull/884), [PR #885](https://github.com/phanthienquoc/TCE-dashboard/pull/885), [PR #888](https://github.com/phanthienquoc/TCE-dashboard/pull/888), [PR #889](https://github.com/phanthienquoc/TCE-dashboard/pull/889), [runtime contract plan](https://github.com/phanthienquoc/TCE-dashboard/blob/master/plan/runtime-contract-standardization.md).

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
