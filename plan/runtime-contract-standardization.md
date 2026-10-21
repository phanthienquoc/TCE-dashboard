## Current task: Record PR #884 evidence and close verified boundary checklist — 2026-10-21

- [x] Record PR #884's verified merge SHA and exact-head CI evidence.
- [x] Mark the DRE/TCE ownership boundary and no-blind-retry safety invariants complete using source and regression evidence.
- [ ] Verify backend build/unit tests and Prettier on the exact latest documentation PR head.
- [ ] Merge only after all required checks pass on the exact latest head and GitHub accepts the merge without bypassing protection.
- Next dependency-safe task: design and test durable retry/replay for failed cross-database lifecycle-event publication; do not apply migrations or enable production routes without authorization.
- Safety: documentation only; no production migration/deployment; LIVE trading remains disabled.

## PR #884 — merged failure-path checklist evidence — 2026-10-21

- PR [#884](https://github.com/phanthienquoc/TCE-dashboard/pull/884) was squash-merged at `e3e1e06731fa1dcb4d5703e5dd562509eb16a3df`; verified against current `master`.
- Exact tested PR head: `585172e3166994da4b1e026b0cfb38c7ee5270ea`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2100](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567212172).
- Prettier passed on the same exact head: [WF-02 run #1552](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39567212217).
- [x] Record PR #883 verification and close the partial-fill/provider-outage/provider-truth failure-path checklist.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- CI note: a concurrent Prettier push was rejected because another formatter run had advanced the branch; the successful formatter commit was followed by a fresh plan commit and green checks on the final head.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #883 — merged explicit SSI provider rejection regression — 2026-10-21

- PR [#883](https://github.com/phanthienquoc/TCE-dashboard/pull/883) was squash-merged at `3ead952afb002e4621777f304f912bb979d4d964`; verified against current `master`.
- Exact tested PR head: `3a23d426b52c52339bef986117638447b0e48739`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2094](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566781904) and [run #2095](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566798347).
- Prettier passed on the same exact head: [WF-02 run #1546](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566782025) and [run #1547](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566798272).
- [x] Surface explicit SSI provider rejection as `PROVIDER_REJECTED`, never as a successful empty snapshot.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #882 — merged reconciliation authorization readiness guard — 2026-10-21

- PR [#882](https://github.com/phanthienquoc/TCE-dashboard/pull/882) was squash-merged at `c638207d26b4b5d0858dca1db05bc4e2f6c80d01`; verified against current `master`.
- Exact tested PR head: `40be3a437e9ad40b14eb3db7b344b24a68c13181`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2088](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566461181) and [run #2089](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566477575).
- Prettier passed on the same exact head: [WF-02 run #1540](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566461014) and [run #1541](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566477670).
- [x] Block SSI reads when reconciliation authorization is not READY; return retryable `PROVIDER_UNAVAILABLE`.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #881 — merged reconciliation authorization environment guard — 2026-10-21

- PR [#881](https://github.com/phanthienquoc/TCE-dashboard/pull/881) was squash-merged at `47e152e22e7a7c703fe9e43f2591517e95d2ccd8`; verified against current `master`.
- Exact tested PR head: `5480ef27f230090dde26a6f41072b9d5c8ba3857`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2083](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566181141) and [run #2084](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566196577).
- Prettier passed on the same exact head: [WF-02 run #1535](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566181129) and [run #1536](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39566196685).
- [x] Reject reconciliation authorization environment mismatches before any SSI read.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #880 — merged authorization gate plan evidence — 2026-10-21

- PR [#880](https://github.com/phanthienquoc/TCE-dashboard/pull/880) was squash-merged at `6dd2cf54ac8098a41d10f87422a9a6df649eadbe`; verified against current `master`.
- Exact tested PR head: `2b36444b1c2f0fcdb10d79691c5677576ccf542e`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2078](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565853115) and [run #2079](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565860623).
- Prettier passed on the same exact head: [WF-02 run #1530](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565853181) and [run #1531](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565860643).
- [x] Record PR #879's verified merge SHA and exact-head CI evidence.
- [x] Complete the non-PAPER authorization gate plan item based on explicit-executor, readiness, and account/environment mismatch coverage.
- Safety: documentation only; no production migration/deployment; LIVE trading remains disabled.

## PR #879 — merged account/environment idempotency scope — 2026-10-21

- PR [#879](https://github.com/phanthienquoc/TCE-dashboard/pull/879) was squash-merged at `7514572c7d424db67212be1d696b37458f9f8282`; verified against current `master`.
- Exact tested PR head: `a8a4da9c141bd20973232fa049cea574aaebc583`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2072](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565404120) and [run #2073](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565424068).
- Prettier passed on the same exact head: [WF-02 run #1524](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565404108) and [run #1525](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565424011).
- [x] Verify duplicate idempotency lookups filter by account, environment, and key.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #878 — merged authorization scope mismatch guard — 2026-10-21

- PR [#878](https://github.com/phanthienquoc/TCE-dashboard/pull/878) was squash-merged at `acb9a1ce36865bc7baa2018b707d5ea3659304e3`; verified against current `master`.
- Exact tested PR head: `9908447cc2c120b987246a5c0896f996f19b178a`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2067](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565132056) and [run #2068](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565139285).
- Prettier passed on the same exact head: [WF-02 run #1519](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565132055) and [run #1520](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39565139385).
- [x] Reject `READY` authorization responses whose account or environment differs from the execution command; provider dispatch is not called.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #877 — merged DRE reconciliation sweep statuses — 2026-10-21

- PR [#877](https://github.com/phanthienquoc/TCE-dashboard/pull/877) was squash-merged at `22b7bcbd6d6aa0d02315524da88deb7f1822974e`; verified against current `master`.
- Exact tested PR head: `f45cda44ee4e32cb4259613f6dd85c49417e7c20`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2059](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564649542) and [run #2060](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564664846).
- Prettier passed on the same exact head: [WF-02 run #1511](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564649502) and [run #1512](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564664926).
- [x] Ensure the reconciliation sweep includes `PENDING`, `UNKNOWN`, and `PARTIAL` records, ordered by submission time.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #876 — merged precomputed DRE action boundary guard — 2026-10-21

- PR [#876](https://github.com/phanthienquoc/TCE-dashboard/pull/876) was squash-merged at `04f6e3bac60d8ea38d3a0670928d7df10f99148e`; verified against current `master`.
- Exact tested PR head: `c78c406f2e77bd559a6141117579fba3b6709c6e`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2054](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564388911) and [run #2055](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564395024).
- Prettier passed on the same exact head: [WF-02 run #1506](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564389018) and [run #1507](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39564395253).
- [x] Pass the original precomputed action unchanged to the explicit LIVE executor.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- CI note: a formatter-generated commit was followed by a plan update and fresh green checks on the final head.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #875 — merged explicit LIVE DRE executor guard — 2026-10-21

- PR [#875](https://github.com/phanthienquoc/TCE-dashboard/pull/875) was squash-merged at `0fa79bf8c585669072f9b522f0ac1fd46430fd00`; verified against current `master`.
- Exact tested PR head: `be084e210a36fb467ffaa0331f29e9a2c77ec678`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2047](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563912827) and [run #2048](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563929452).
- Prettier passed on the same exact head: [WF-02 run #1499](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563912843) and [run #1500](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563929434).
- [x] Reject new LIVE actions without an explicit execution adapter before persisting a PENDING record.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #874 — merged DRE PARTIAL no-redispatch guard — 2026-10-21

- PR [#874](https://github.com/phanthienquoc/TCE-dashboard/pull/874) was squash-merged at `3f853f150f2a6ae11c41f81aa847ef4582e4441d`; verified against current `master`.
- Exact tested PR head: `9ee3a3ec5644536985524f81982dfc241b8619a6`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2042](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563605631) and [run #2043](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563611272).
- Prettier passed on the same exact head: [WF-02 run #1494](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563605691) and [run #1495](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563611279).
- [x] Return persisted DRE `PARTIAL` actions unchanged without submitting duplicate broker orders.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- CI note: one concurrent Prettier push failed with a non-fast-forward rejection; the formatter's successful commit was followed by a fresh plan commit and green checks on the final head.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #873 — merged DRE UNKNOWN no-redispatch guard — 2026-10-21

- PR [#873](https://github.com/phanthienquoc/TCE-dashboard/pull/873) was squash-merged at `3c3d7fff474d0a2a767d9f674460a94d386734a3`; verified against current `master`.
- Exact tested PR head: `fc2f6fc82b3e05138ef1847fb4bf112de356eaf0`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2036](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563252155) and [run #2037](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563258023).
- Prettier passed on the same exact head: [WF-02 run #1488](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563252186) and [run #1489](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39563258074).
- [x] Return persisted DRE `UNKNOWN` actions without redispatch even when LIVE execution is enabled.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #872 — merged durable UNKNOWN duplicate execution guard — 2026-10-21

- PR [#872](https://github.com/phanthienquoc/TCE-dashboard/pull/872) was squash-merged at `737ca2183be5cc5990755cfcd54ad3baaa83b25d`; verified against current `master`.
- Exact tested PR head: `b1a4f942e3eeedffd3f29d2226bc8373bd01747d`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2030](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562757291) and [run #2031](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562803721).
- Prettier passed on the same exact head: [WF-02 run #1482](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562757278) and [run #1483](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562803850).
- [x] Return persisted `UNKNOWN` execution results with reconciliation required and do not call the provider again.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #871 — merged terminal UNKNOWN completion guard — 2026-10-21

- PR [#871](https://github.com/phanthienquoc/TCE-dashboard/pull/871) was squash-merged at `b50ba514c3cf7a06dcdd54a9046f36b7aefa9b2c`; verified against current `master`.
- Exact tested PR head: `8f6489c8ed021cabde13478ef026c72f466f0488`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2025](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562456465) and [run #2026](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562471988).
- Prettier passed on the same exact head: [WF-02 run #1477](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562456497) and [run #1478](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39562472054).
- [x] Prevent a later completion attempt from overwriting a terminal `UNKNOWN` reservation.
- [x] Verify exact-head CI and squash-merge only after GitHub accepted the merge without a protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #867 — merged ambiguous-provider orphan suppression — 2026-10-21

- PR [#867](https://github.com/phanthienquoc/TCE-dashboard/pull/867) was squash-merged at `6019ebce307f369e706e177ef5f6c0330b6212ad`; verified against the `master` ref after merge.
- Exact tested PR head: `3cb42b14e8ecfab6d73fc58ec887da432272c46e`, reconciled with `master` commit `d6dd0551c0147c62203a064e8faeeeaad0d6f733`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2005](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561067201) and [run #2006](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561076085).
- Prettier passed on that exact head: [WF-02 run #1457](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561066988) and [run #1458](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561076139).
- [x] Ambiguous provider rows no longer emit duplicate orphan deltas; affected local orders fail closed with `RECONCILIATION_REQUIRED`.
- PR [#869](https://github.com/phanthienquoc/TCE-dashboard/pull/869) was squash-merged at `db28069b0793ada11458abb30f0ac8f5cc61647a`; exact-head CI evidence is recorded in its verified merge section.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## PR #868 — merged unconfirmed SSI submission handling — 2026-10-21

- PR [#868](https://github.com/phanthienquoc/TCE-dashboard/pull/868) was squash-merged at `089d94238e740a4eec6a25da361a84fc683fcee7`; verified against current `master`.
- Exact tested PR head: `b145b21ba590a9158b3b383d4ff00b5768992e2b`.
- Backend build/unit tests passed on that exact head: [WF-05 run #2011](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561573836) and [run #2012](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561578969).
- Prettier passed on the same exact head: [WF-02 run #1463](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561573956) and [run #1464](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39561579184).
- [x] Treat SSI `confirmed: false` as a non-success `PENDING` result requiring reconciliation.
- [x] Add adapter regression coverage for unconfirmed provider submission responses.
- [x] Add durable-orchestrator regression coverage proving duplicate requests do not redispatch an unconfirmed submission.
- [x] Verify backend build/unit tests and Prettier on the exact latest PR head.
- [x] Squash-merge PR #868 only after exact-head checks passed and GitHub accepted the merge; no protection bypass.
- Safety: no production migration/deployment; LIVE trading remains disabled.

## Automation recovery — PR #865 merged — 2026-10-21

- PR [#865](https://github.com/phanthienquoc/TCE-dashboard/pull/865) was squash-merged at `d4ff9a4ae469e8c4124927e11d13046ef6ec77fd`.
- Exact verified head: `5f865d751dbfa695c8439f8a5a21d836274deb46`.
- Backend build/unit tests passed on that exact head: [run #1943](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39539207470). Prettier passed: [run #1446](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39539207463).
- This closes the one-provider-to-multiple-local identity ambiguity task. The next safe task should continue reconciliation reliability (for example, ensure ambiguous shared provider IDs cannot also produce a duplicate ORPHAN disposition, and cover that behavior with regression tests) or another earliest unblocked unchecked runtime-contract task.
- Automation remains enabled and must not be paused on blockers. No production migration/deployment and no LIVE trading.

## Automation checkpoint — PR #865 verification blocker — 2026-10-21

- PR [#865](https://github.com/phanthienquoc/TCE-dashboard/pull/865) is open on dedicated branch `fix/reconciliation-provider-local-one-to-many`.
- Implementation and regression test have been pushed to the branch. The intended fix makes one provider identity matching multiple local orders return `RECONCILIATION_REQUIRED` for all affected local orders.
- Latest observed PR head from GitHub metadata was `1c381efdbe60417f23a776cd46182ca4135d54d0`; Actions returned zero runs for that SHA. Earlier runs on `06c36107fac5b9ad3e7dbf5b106c6a8a00ea3bee` were still in progress and do not verify any later formatter-generated head.
- Merge is prohibited until backend build/unit tests and Prettier complete green on the exact latest head. Do not claim this PR is verified or merged before new evidence exists.
- Blocker: GitHub Actions currently exposes no runs for the observed latest PR head. Next cycle must inspect the PR and Actions again, diagnose any missing trigger, and retry safely.
- Automation must remain enabled. No production migration/deployment and no LIVE trading.

## Current task: Reject one-to-many provider/local identity matches — 2026-10-21

- [x] Build the full local/provider identity mapping before classification.
- [x] Fail closed with `RECONCILIATION_REQUIRED` when a single provider order identity matches multiple local orders.
- [x] Add regression coverage for a provider order matched through providerOrderId by one local order and clientRequestId by another.
- [ ] Verify backend build/unit tests and Prettier on the exact latest PR head, including any formatter-generated commit.
- [ ] Merge only after required checks pass on the exact latest head and all enforced review/branch-protection requirements are satisfied.
- Safety: no production migration/deployment and no LIVE trading changes.

## Automation continuity correction — 2026-10-21

- The hourly `TCE PR CI & Plan Loop` was disabled by an earlier assistant action after a file-write safety-gate failure. This was incorrect: a blocker is not a reason to pause the schedule.
- The loop has been re-enabled. On a blocked action, continue read-only diagnosis and independent dependency-safe work; record the blocker and retry on the next hourly cycle.
- Verified latest reconciliation checkpoint: PR #863 is merged at `21737eb769c4250504b99a668a3b8128403938b4`; its exact head was `5db788e06657ce65b3bb9086a76e211ac0f3845a`, with Backend and Prettier reported green in the canonical Notion evidence.
- Follow-up items remain open unless supported by new evidence: ownership-boundary verification, event/idempotency migration and staging gates, account/environment/auth/risk dispatch gates, partial-fill/provider-outage/provider-truth failure-path tests, unknown-outcome no-resubmit behavior, and durable cross-database event replay.
- Next step: choose the next small unblocked follow-up, implement and test on a dedicated branch, update plan evidence, and open a PR. No production migration/deployment and no LIVE trading.

# Runtime Boundary Standardization — implementation plan

**Repository:** `phanthienquoc/TCE-dashboard`  
**Tracking issues:** #845, #849  
**Base branch:** `master`  
**Workflow:** each task has a dedicated branch and PR; validate latest head, fix failures, squash-merge only when green.

## Goal

Standardize runtime ownership and provider/domain/event contracts incrementally. Preserve existing behavior and public API compatibility. Do not enable live order submission, run production migrations, or deploy as part of this refactor.

## Phase 0 — Baseline and architecture

- [x] Inventory existing platform, execution, risk, authorization and reconciliation contracts plus DRE architecture.
- [x] Add `docs/architecture/runtime-boundaries.md`.
- [x] Record safety assumptions and migration rules.

## Phase 1 — Canonical event contract

- [x] Add `TceEventEnvelope` schema version 1, typed event names/data, structural runtime validation, known-event-name guard and provider-neutral `TceEventPublisherPort`.
- [x] Export event contract without removing existing barrel exports.
- [x] Add focused tests for event identity, version, timestamps, scope, sequence and required data.
- [x] Validate event-specific payloads at runtime for every registered event type, including nested account snapshot and execution error fields.
- [x] Add automated import-boundary tests for pure engine, TCE decision/scanner, Monitor and DRE provider dependencies.
- [x] Squash-merge foundation PR #846 into `master` at `36e7304b6c5c40b1c6352357e59474649a9799f9`.
- [x] Verify backend build/unit tests and Prettier passed on the foundation head (runs #1898 and #1401).

## Phase 2 — Runtime ownership boundaries

- [x] Document ownership boundaries: service composition/transport, contracts, pure TCE Core, platform providers, Monitor, DRE, Execution Orchestrator and reconciliation.
- [x] Migrate Monitor snapshot emission through `TceEventPublisherPort`; events carry stable event IDs, schema version, account/aggregate scope and correlation IDs. Publisher failure is logged and does not interrupt snapshot/audit/cashout behavior.
- [x] Emit DRE campaign status, rolling sequence/position, T+2 settlement and capital-recycling transitions through the shared event contract; event publishing has no order-dispatch authority.
- [x] Enforce DRE_ENABLED and DRE_LIVE_EXECUTION at SafeOrderExecutionService.submit before database or provider work.
- [x] Verify DRE owns campaign/sequence/T+2/continuity/GAP; TCE Core owns strategy decisions; only the authorized execution path dispatches broker commands.
  Evidence: [DRE README](https://github.com/phanthienquoc/TCE-dashboard/blob/master/apps/service/src/dre/README.md), [DRE types](https://github.com/phanthienquoc/TCE-dashboard/blob/master/apps/service/src/dre/dre.types.ts), [DRE production boundary](https://github.com/phanthienquoc/TCE-dashboard/blob/master/apps/service/src/dre/dre-production.service.ts), and pass-through/explicit-executor regression coverage in [PR #875](https://github.com/phanthienquoc/TCE-dashboard/pull/875), [PR #876](https://github.com/phanthienquoc/TCE-dashboard/pull/876), [PR #873](https://github.com/phanthienquoc/TCE-dashboard/pull/873).

## Phase 3 — Unified transports

- [x] Define canonical REST success/error DTO semantics and a separate transport-control error frame without misrepresenting it as a persisted domain event.
- [x] Implement account-scoped REST replay, SSE polling, and a read-only WebSocket stream over the same canonical event envelopes.
- [x] Derive account scope from the verified bearer identity or the existing auth-service session introspection; ignore caller-supplied account IDs.
- [x] Add composite timestamp/event-ID replay cursors to avoid losing events with tied timestamps.
- [x] Validate event names, envelope structure, cursor, limit and transport filter inputs at runtime.
- [x] Reject persisted events with malformed event-specific payloads before REST/SSE/WebSocket delivery.
- [x] Apply WebSocket origin checks for cookie-authenticated sessions; optionally configure TCE_EVENT_WS_ALLOWED_ORIGINS.
- [x] Add focused contract, query, REST/SSE and cursor tests; include apps/service/src/runtime-events in backend test discovery.
- [x] Backend build/unit tests passed on final head (run #1909); Prettier passed (#1412); squash-merged PR #853 at `1040823b4281b21f6057ce4015b6a80ca3bced74`.
- [ ] Verify the runtime event migration has been applied in the target environment before enabling event routes in production.

## Phase 4 — Execution reliability

- [x] Define provider-neutral durable idempotency store port scoped by account/environment/key/fingerprint.
- [x] Add an additive SQL migration for reservations and persisted results; table RLS is enabled and direct client-role access is revoked.
- [x] Squash-merge durable idempotency foundation PR #851 at `caa64bd4ebaf2cc99b966c2cfe606bfcbf8f689d` after backend run #1903 and Prettier run #1406 passed.
- [x] Add a Supabase adapter with unique composite reservation keys, fingerprint conflict detection, guarded `PENDING` completion and durable `UNKNOWN` status.
- [x] Extend Execution Orchestrator with deterministic command fingerprints, optional durable-store injection, conflicting-key rejection and no replay of existing `PENDING`/`UNKNOWN` reservations.
- [x] Add focused tests for duplicate keys, conflicting fingerprints, separate account scopes, persisted results and unknown outcomes.
- [x] Wire `TceExecutionOrchestrator` into the production auto-sell entry point (`ProfitExitExecutionService`) and inject the Supabase durable store behind `TCE_DURABLE_EXECUTION_IDEMPOTENCY_ENABLED=true`.
- [ ] Enable the durable-store flag only after migration `202610210001_tce_execution_idempotency.sql` is applied and staging verification passes.
- [x] Enforce account/environment scope, current authorization validation and risk/safety gate before any non-PAPER dispatch.
      Evidence: PR [#875](https://github.com/phanthienquoc/TCE-dashboard/pull/875) proves an explicit executor is required for new LIVE actions; PR [#878](https://github.com/phanthienquoc/TCE-dashboard/pull/878) rejects mismatched account/environment authorization; [trading authorization tests](https://github.com/phanthienquoc/TCE-dashboard/blob/master/libs/tce/src/execution/trading-authorization.spec.ts) cover readiness failures.
- [x] Cover store-reservation failure (no provider dispatch, retryable READY order), persistence failure after dispatch (UNKNOWN), and existing PENDING reservation (reconciliation required).
- [x] Complete remaining failure-path tests for partial fills, provider outage and reconciliation from provider truth.
      Evidence: DRE PARTIAL no-redispatch [PR #874](https://github.com/phanthienquoc/TCE-dashboard/pull/874), reconciliation sweep statuses [PR #877](https://github.com/phanthienquoc/TCE-dashboard/pull/877), authorization failure paths [PR #881](https://github.com/phanthienquoc/TCE-dashboard/pull/881) and [PR #882](https://github.com/phanthienquoc/TCE-dashboard/pull/882), explicit provider rejection [PR #883](https://github.com/phanthienquoc/TCE-dashboard/pull/883); provider-outage and provider-truth cases are in the linked reconciliation adapter and order-state reconciler specs.
- [x] Add a timeout-after-dispatch regression test proving the result stays UNKNOWN, reconciliation is required, and a duplicate request does not call the provider again (test-store contract; commit `a50c30891a38707efd0e7f80dae7595918e0cca4`). Backend build/unit tests and Prettier passed on PR head `6f63b025336d2158ea9d38f26f88816cc222c963` (runs #1925 and #1428). This test uses an in-memory implementation of the durable-store interface; production Supabase adapter integration/reconciliation remains a separate verification item.
- [x] Ensure unknown outcomes require reconciliation and can never be blindly resubmitted; covered by PRs #868, #870, #871 and #872 regression tests.

## Phase 5 — Rollout

- [ ] Keep schema change additive and backward compatible; do not apply the migration automatically to production.
- [ ] Run event/contract tests, Node and Vitest suites, service/web typecheck, backend build, lint and diff review on each latest PR head.
- [ ] Open a separate PR per task, with required CI green before squash merge into `master`.
- [ ] Verify deployments separately after code is merged; this implementation does not deploy or enable LIVE trading.

## Current task: Runtime event payload validation

- [x] Add per-event runtime guards for all 10 registered event types without introducing a new schema dependency.
- [x] Validate nested account balance/position/order payloads and execution error codes.
- [x] Enforce validation in the Supabase publisher before persistence and in the query service before transport delivery.
- [x] Add positive/negative contract tests for all event types and tests proving malformed events are not persisted or streamed.
- [x] Backend build/unit tests passed on head `efd72f798e5e83db418686e0a4df4896bde217c5` (run #1922); Prettier passed (#1425).
- [ ] Squash-merge after final checks pass on the documentation head.

## Previous task: DRE live execution safety gate

- [x] Enforce DRE_ENABLED and DRE_LIVE_EXECUTION directly at the safe execution boundary, not only in a helper service.
- [x] Reject LIVE before index, database, or provider work unless DRE_LIVE_EXECUTION=true; keep DRY_RUN available while DRE is enabled.
- [x] Add tests proving disabled LIVE execution never reaches the provider and DRE_ENABLED=false blocks all execution modes.
- [x] Backend build/unit tests passed on head `a239794e386e836576abdcdcec71055e1269f288` (run #1918); Prettier passed (#1421).
- [ ] Squash-merge after checks pass again on the final documentation head.

## Previous task: DRE lifecycle event emission

- [x] Add a shared DRE lifecycle event service using the canonical versioned event envelope and stable transition event IDs.
- [x] Emit after campaign creation/status changes, rolling-position transitions, T+2 availability and confirmed capital recycling.
- [x] Keep Mongo lifecycle state authoritative; publisher/metadata failures are logged and do not interrupt valid state transitions.
- [x] Add lifecycle-event and campaign-service tests; include DRE specs in backend test discovery.
- [x] Backend build/unit tests passed on the pre-format head (run #1915); Prettier passed and applied formatting (#1418).
- [x] Backend build/unit tests passed on final head (run #1916); Prettier passed (#1419); squash-merged PR #855 at `67d90aa3462166224361a2d74402af82f7528e1b`.
- [ ] Add durable retry/replay for failed cross-database event publication; Mongo and Supabase do not share a transaction.

## Previous task: Durable execution wiring

- [x] Route production auto-sell dispatch through `TceExecutionOrchestrator` rather than calling the SSI adapter directly.
- [x] Inject the Supabase idempotency store only when `TCE_DURABLE_EXECUTION_IDEMPOTENCY_ENABLED=true`; default-off preserves safe rollout until the DB migration is applied.
- [x] If reservation storage is unavailable, do not call the provider and leave the order READY for retry.
- [x] If dispatch outcome cannot be durably recorded, return UNKNOWN and require reconciliation; never turn an ambiguous outcome into REJECTED.
- [x] Treat existing PENDING reservations as reconciliation-required and never redispatch.
- [x] Add orchestrator failure-boundary and Profit Exit service tests.
- [x] Backend build/unit tests passed on head `ce377a988ae525fe15e2dd92e4d628a2d8be972d` (run #1912); Prettier passed (#1415).
- [ ] Squash-merge this task only after checks pass again on the final documentation head.
- [ ] Apply the additive migration in a controlled environment, verify staging, then explicitly enable the feature flag.

## Previous task: Monitor event emission

- [x] Add SupabaseRuntimeEventPublisher implementing the shared TceEventPublisherPort.
- [x] Add an RLS-protected tce_runtime_events outbox migration; grant access only to service_role.
- [x] Emit monitor.snapshot.created after snapshot persistence with a deterministic event ID and account/correlation metadata.
- [x] Register the Monitor module with explicit scheduler opt-in (TCE_MONITOR_SCHEDULER_ENABLED=true) so module registration alone cannot start the legacy scheduler.
- [x] Backend build/unit tests and Prettier passed on the formatted head before PR #852 merge (runs #1906 and #1409).

## Previous task: Unified runtime event transports

- [x] REST/SSE/WebSocket share canonical event envelopes and authenticated account scope.
- [x] Backend build/unit tests and Prettier passed on final head (runs #1909 and #1412).
- [x] Squash-merged as PR #853 into `master` at `1040823b4281b21f6057ce4015b6a80ca3bced74`.
- [ ] Apply the additive runtime-event migration before enabling routes in production.

## Acceptance criteria

- [x] One canonical versioned event envelope and typed event map in `libs/contracts`.
- [x] Boundary ownership is documented and import-boundary tests exist.
- [x] Durable idempotency port, SQL schema and adapter exist.
- [x] Monitor emits through the shared event contract without gaining order-dispatch authority.
- [x] DRE lifecycle transitions publish canonical events without gaining broker-dispatch authority.
- [x] DRE LIVE execution is rejected at the dispatch boundary unless explicitly enabled by configuration.
- [x] REST/WS/SSE share the canonical event envelope, event IDs and correlation IDs.
- [x] Production auto-sell code path is wired to the durable orchestrator behind a rollout flag.
- [ ] Durable idempotency is enabled in production only after migration and staging validation.
- [x] Unknown outcomes require reconciliation, not blind retry.
  Evidence: exact-head regression coverage in [PR #868](https://github.com/phanthienquoc/TCE-dashboard/pull/868), [PR #870](https://github.com/phanthienquoc/TCE-dashboard/pull/870), [PR #871](https://github.com/phanthienquoc/TCE-dashboard/pull/871), [PR #872](https://github.com/phanthienquoc/TCE-dashboard/pull/872), and [PR #873](https://github.com/phanthienquoc/TCE-dashboard/pull/873).
- [ ] Compatibility and rollout gates pass before production migration/deployment.

## Safety notes

- Migration `202610210002_tce_runtime_events.sql` is additive and has not been applied to production.
- Monitor scheduling stays off unless `TCE_MONITOR_SCHEDULER_ENABLED=true`; manual invocation remains protected by `TCE_MONITOR_RUN_SECRET`.
- No live order submission, LIVE-mode enablement, production DB migration, or deployment is authorized by this refactor.
- An adapter implementation or Nest provider is not proof of runtime durability until the actual dispatch path injects and uses it.
- Event envelopes and event-specific payloads are both validated at the publisher and read boundary.
- DRE lifecycle event publication is best-effort across MongoDB and Supabase; it is not an atomic outbox until durable replay/reconciliation is implemented.
- DRE campaign events currently have no accountId because campaigns are global; account-scoped REST/SSE/WebSocket streams intentionally do not expose them until an explicit global/admin visibility policy is defined.

## Current task: Partial-fill reconciliation quantity guards — 2026-10-21

- [x] Validate local and provider order quantity fields before missing/orphan/terminal/partial-fill classification.
- [x] Fail closed with `RECONCILIATION_REQUIRED` for non-finite quantities, non-positive order quantity, negative filled quantity, or filled quantity exceeding order quantity.
- [x] Add regression tests for invalid local/provider quantities and unmatched invalid orders.
- [ ] Run backend unit tests/build and Prettier on the exact PR head; only mark verification complete when the resulting GitHub Actions runs are green.
- [ ] Open PR and merge only after required checks pass on the latest head and review/branch requirements are verified.
- Safety: no production migration/deployment and no LIVE trading changes.

- CI checkpoint: backend build/unit tests passed on pre-format commit `b39262813ba723edc3a3dc0d95153df6aa603df3` (run [#1930](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39526077460)); Prettier passed on that same head (run [#1431](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39526077465)). Prettier then applied formatting in commit `a7964aa88d00ed7c7a6a4c257efb4f5fddd0e2cf`; the branch was re-squashed to `a5f4dee33c927228168f925dff2c497d34166244`. The formatted head has not yet emitted new checks, so latest-head verification remains pending and merge is prohibited until verified.

- CI checkpoint (2026-10-21): Prettier workflow auto-format commit advanced the PR head to `62d48b040a401674e34a6943629a9f47607a6758`; checks have not yet been triggered for that exact SHA. Re-run latest-head backend build/unit tests and Prettier before considering merge.

## Current task: Provider outage and timeout failure-path handling — 2026-10-21

- [x] Normalize thrown SSI order-query failures to a structured retryable `PROVIDER_UNAVAILABLE` result instead of leaking exceptions.
- [x] Normalize provider timeout exceptions to `TIMEOUT_UNKNOWN`; do not represent failed provider reads as an empty successful snapshot.
- [x] Normalize thrown account-resolution failures to a structured retryable result.
- [x] Backend build/unit tests passed on exact formatted head `931627f99e48f1bd16351a8f59d8cb25535b807a` (run [#1935](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39531084211)); Prettier passed in run [#1438](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39531084265). Squash-merged PR #861 at `6d4967a7832274d6df62fedafe5e98cd90cd4f30`.
- [x] Continue provider-truth reconciliation work in a follow-up PR covering partial fills and malformed provider quantity data.
- Safety: no production migration/deployment; durable idempotency rollout flag remains off; LIVE trading remains disabled.

- CI checkpoint (2026-10-21): Prettier auto-format advanced PR #861 to head `e9bc444320af82edea11d95f5de2d36fdace69de`; that exact SHA currently has no check runs. This plan-only commit is intended to trigger backend build/unit tests and Prettier on the formatted head. Do not merge until checks on the resulting latest head complete successfully.

## Current task: Provider-truth quantity validation — 2026-10-21

- [x] Preserve provider partial-fill quantity/status through the SSI reconciliation adapter.
- [x] Treat non-finite, non-positive, negative-fill, overfill, and missing filled quantity as UNKNOWN rather than safely open/terminal.
- [x] Add adapter regression tests for valid partial fills, provider overfill, and missing fill quantity.
- [x] Backend build/unit tests passed on exact formatted head `6ba69c020d59885ddcfc2e23cd3e4593063b2928` (run [#1937](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39531358015)); Prettier passed on the same head (run [#1440](https://github.com/phanthienquoc/TCE-dashboard/actions/runs/39531358006)).
- [x] Squash-merged PR #862 at `0bdb82630e75f279831530d7a8a3dc8bef4ae044`.
- [x] Next follow-up: ambiguous provider identity matching is being hardened in a dedicated PR.
- Safety: no production migration/deployment; durable idempotency rollout flag remains off; LIVE trading remains disabled.

- CI checkpoint (2026-10-21): Prettier auto-format advanced PR #862 to `cf9094c1aff0895dab13ca9a2bc48184f37dd708`; no checks exist yet on that exact SHA. This plan-only commit triggers backend unit tests/build and Prettier on the formatted head. Do not merge until both complete successfully on the resulting latest head.

## Current task: Ambiguous provider identity reconciliation — 2026-10-21

- [x] Detect when multiple provider orders match a single local order by provider order ID or client request ID.
- [x] Return `RECONCILIATION_REQUIRED` for ambiguous matches instead of choosing the first provider row or treating duplicates as harmless.
- [x] Add regression tests for duplicate provider order IDs and duplicate client request IDs.
- [ ] Verify backend build/unit tests and Prettier on the exact latest PR head, including any formatter-generated commit.
- [ ] Merge only after all required checks pass on the exact latest head.
- Safety: no production migration/deployment; durable idempotency rollout flag remains off; LIVE trading remains disabled.

- CI checkpoint (2026-10-21): Prettier auto-format advanced PR #863 to `fcd079bac3377753f46771e2ee98fcf75ae806b8`; the checks on the earlier head do not verify this formatted commit. This plan-only commit triggers backend build/unit tests and Prettier on the formatted head. Do not merge until the latest-head checks complete successfully.
