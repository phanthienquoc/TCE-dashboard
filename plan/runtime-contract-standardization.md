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
- [ ] Verify DRE owns campaign/sequence/T+2/continuity/GAP; TCE Core owns strategy decisions; only the authorized execution path dispatches broker commands.

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
- [ ] Enforce account/environment scope, current authorization validation and risk/safety gate before any non-PAPER dispatch.
- [x] Cover store-reservation failure (no provider dispatch, retryable READY order), persistence failure after dispatch (UNKNOWN), and existing PENDING reservation (reconciliation required).
- [ ] Complete remaining failure-path tests for partial fills, provider outage and reconciliation from provider truth.
- [x] Add a timeout-after-dispatch regression test proving the result stays UNKNOWN, reconciliation is required, and a duplicate request does not call the provider again (test-store contract; commit `a50c30891a38707efd0e7f80dae7595918e0cca4`). Backend build/unit tests and Prettier passed on PR head `6f63b025336d2158ea9d38f26f88816cc222c963` (runs #1925 and #1428). This test uses an in-memory implementation of the durable-store interface; production Supabase adapter integration/reconciliation remains a separate verification item.
- [ ] Ensure unknown outcomes require reconciliation and can never be blindly resubmitted.

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
- [ ] Unknown outcomes require reconciliation, not blind retry.
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
- [ ] Verify backend build/unit tests and Prettier on the exact latest PR head, including any Prettier auto-format commit.
- [ ] Merge only after all required checks pass on the exact latest head; then continue provider/local drift and duplicate-provider-ID reconciliation coverage.
- Safety: no production migration/deployment; durable idempotency rollout flag remains off; LIVE trading remains disabled.

- CI checkpoint (2026-10-21): Prettier auto-format advanced PR #862 to `cf9094c1aff0895dab13ca9a2bc48184f37dd708`; no checks exist yet on that exact SHA. This plan-only commit triggers backend unit tests/build and Prettier on the formatted head. Do not merge until both complete successfully on the resulting latest head.
