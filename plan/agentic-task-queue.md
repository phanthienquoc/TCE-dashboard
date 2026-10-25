# TCE Dashboard — Agent Task Queue

**Last audited:** 2026-10-25  
**Default branch:** `master` at `a47cc1063354abd2ea58219dd5af570a0a5e2b4a`  
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

- **Priority/status:** P2 / BLOCKED on full-app viewport review — [canonical PR #892](https://github.com/phanthienquoc/TCE-dashboard/pull/892) remains open. Browser CSS contract, Prettier and backend checks passed on head `4133e871f11a73b85733ec901c5a8c6d491c20bf`; a full running-dashboard preview/capture is still unavailable.
- **Implementation branch:** `feat/tce-ui-001-consolidated-landscape`; current combined CSS is 1,613 lines with the original 939-line master prefix preserved.
- **Evidence paths:** `apps/web/app/mobile-command-center.css`, `apps/web/components/dashboard/DividendPositionsView.tsx`.
- **Current behavior:** Open PRs #809 and #810 append overlapping phone-landscape styles to the same CSS file; PR #811 adds a position-HUD class plus tablet/desktop layout rules. Their heads are stale and had no check-runs when inspected. All three CSS branches share the exact 939-line CSS prefix from current master SHA `aaf039a0ad3c9b2a27e16eb56e0eaf745dc41835`.
- **Desired behavior:** One canonical PR preserves the full landscape-mode design, density overrides and positions HUD layout while keeping portrait styling unchanged and making the precedence between shared landscape rules explicit through append order.
- **Acceptance criteria:**
  - Compare the three source diffs and preserve their distinct behavior; do not silently drop the positions root class.
  - Include common phone landscape CSS viewports up to 950px wide and 500px high while preserving portrait and desktop behavior; keep tablet/desktop positions rules separately scoped.
  - Preserve portrait behavior and avoid adding runtime/data/API changes.
  - Run repository CI on the exact final head; report any visual/browser checks that are not available rather than claiming them passed.
  - After the canonical PR passes checks and is merge-safe, close superseded PRs #809/#810/#811 with a link to the canonical result.
- **Validation:** Static base-prefix comparison passed for all three CSS branches (939 shared lines); combined source currently contains 325 lines from #809, 256 lines from #810 and 96 lines from #811. On exact head `1e94ee9aa4b3ff7de43ea7cd5c5c4abe490afe1e`, WF-02 Prettier runs [#40214439611](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214439611) and [#40214436059](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214436059) passed; WF-05 backend test runs [#40214439601](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214439601) and [#40214435950](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40214435950) passed. Added `.github/workflows/wf-11-tce-mobile-landscape-viewport.yml` and `apps/web/scripts/mobile-landscape-viewport.test.mjs` using the repository's existing Puppeteer dependency. The fixture measures computed CSS/layout at four target viewports and uploads screenshots. The previous `max-width: 767px` landscape query excluded a common 844×390 iPhone landscape viewport; the CSS now uses a 950px width / 500px height envelope with a separate short-height rule. On head `4133e871f11a73b85733ec901c5a8c6d491c20bf`, WF-02 Prettier [#40225348743](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225348743), WF-05 backend tests [#40225348471](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225348471), and WF-11 Chromium viewport contract [#40225348466](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40225348466) all passed. Computed metrics confirm the 844×430 and 844×390 landscape layouts use a 42px top nav, six-column nav grid, full-width workspace, vertical scrolling, no horizontal overflow and a hidden page heading. Portrait 390×844 retains its bottom navigation and scroll container; desktop 1280×800 retains the 480px centered view. [Earlier fixture screenshot artifact](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224457099/artifacts/12610870705). This is a CSS/layout fixture using the stylesheet cascade from `apps/web/app/layout.tsx`, not a running-app capture. No full-app visual pass is claimed; actual application preview review remains the merge gate. The queue update itself changes the PR head, so final-head CI must rerun.
- **Dependencies:** None; use current master as the merge base.
- **Risk:** Medium — CSS precedence and small-height layouts may regress. No backend, trading, schema, production release or live-order behavior is changed.
- **Links:** [PR #809](https://github.com/phanthienquoc/TCE-dashboard/pull/809), [PR #810](https://github.com/phanthienquoc/TCE-dashboard/pull/810), [PR #811](https://github.com/phanthienquoc/TCE-dashboard/pull/811).

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

- **Priority/status:** P1 / IN PROGRESS — dedicated branch `fix/wf-02-prettier-pull-request-race`; PR will be opened after the workflow and queue changes are validated.
- **Evidence paths:** `.github/workflows/wf-02-tce-prettier-format.yml`, `plan/agentic-task-queue.md`.
- **Current behavior/evidence:** On 2026-10-25, run [#40224363153](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224363153) completed Prettier formatting, then failed at the formatter bot's `git push` with `[rejected] (fetch first)`. The workflow triggers on both `push` and `pull_request`, and both events previously ran a write-and-push job under different concurrency groups. Concurrent runs could therefore race on the same branch. This reproduces the class of failure previously recorded in [run #39567566629](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567566629).
- **Desired behavior:** Pull-request runs perform a read-only `prettier --check` with `contents: read`; push/manual runs alone may format and commit with `contents: write`. Concurrency groups are event-specific. Never force-push or let a PR check mutate its head branch.
- **Acceptance criteria:** The PR check retains the existing `Prettier auto-format & commit` check name; PR events contain no git-push step; push/dispatch formatting succeeds on the current head; no concurrent formatter push rejection remains; exact-head Prettier and backend checks pass.
- **Tests/validation:** Reproduced in run [#40224363153](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224363153): formatter step succeeded and push step failed. Fix validation is pending on this dedicated branch.
- **Dependencies:** None.
- **Risk:** Low; workflow-only behavior change. PR runs lose write permission, and automatic formatting remains available on push/dispatch.
- **Sources:** [failed formatter job logs](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/40224363153), [canonical UI PR #892](https://github.com/phanthienquoc/TCE-dashboard/pull/892), [prior race evidence](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567566629).

## Audit snapshot

- **Open PRs:** #809, #810, #811; all are stale and overlap in the same stylesheet. Their current heads had no check-runs in the audited GitHub endpoint; this is a validation gap, not proof that the code fails.
- **Open runtime issues:** #845 (architecture umbrella) and #848 (implementation tracker). Exact duplicate #849 is closed.
- **Recent workflow state:** scheduled healthcheck, integration-check and backup runs audited on 2026-10-24/25 are green. Historical 2026-10-21 formatter failure is classified above.
- **Next implementation task:** TCE-RUNTIME-001 durable retry/replay for lifecycle-event publication. Continue independently of auth user-management work; do not touch repositories outside this queue's scope.
