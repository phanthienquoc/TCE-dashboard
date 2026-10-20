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
- [x] Add automated import-boundary tests for pure engine, TCE decision/scanner, Monitor and DRE provider dependencies.
- [x] Squash-merge foundation PR #846 into `master` at `36e7304b6c5c40b1c6352357e59474649a9799f9`.
- [x] Verify backend build/unit tests and Prettier passed on the foundation head (runs #1898 and #1401).

## Phase 2 — Runtime ownership boundaries

- [x] Document ownership boundaries: service composition/transport, contracts, pure TCE Core, platform providers, Monitor, DRE, Execution Orchestrator and reconciliation.
- [x] Migrate Monitor snapshot emission through `TceEventPublisherPort`; events carry stable event IDs, schema version, account/aggregate scope and correlation IDs. Publisher failure is logged and does not interrupt snapshot/audit/cashout behavior.
- [ ] Verify DRE owns campaign/sequence/T+2/continuity/GAP; TCE Core owns strategy decisions; only the authorized execution path dispatches broker commands.

## Phase 3 — Unified transports

- [x] Define canonical REST success/error DTO semantics and a separate transport-control error frame without misrepresenting it as a persisted domain event.
- [x] Implement account-scoped REST replay, SSE polling, and a read-only WebSocket stream over the same canonical event envelopes.
- [x] Derive account scope from the verified bearer identity or the existing auth-service session introspection; ignore caller-supplied account IDs.
- [x] Add composite timestamp/event-ID replay cursors to avoid losing events with tied timestamps.
- [x] Validate event names, envelope structure, cursor, limit and transport filter inputs at runtime.
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
- [ ] Complete remaining failure-path tests for timeout-after-dispatch, partial fills, provider outage and reconciliation from provider truth.
- [ ] Ensure unknown outcomes require reconciliation and can never be blindly resubmitted.

## Phase 5 — Rollout

- [ ] Keep schema change additive and backward compatible; do not apply the migration automatically to production.
- [ ] Run event/contract tests, Node and Vitest suites, service/web typecheck, backend build, lint and diff review on each latest PR head.
- [ ] Open a separate PR per task, with required CI green before squash merge into `master`.
- [ ] Verify deployments separately after code is merged; this implementation does not deploy or enable LIVE trading.

## Current task: Durable execution wiring

- [x] Route production auto-sell dispatch through `TceExecutionOrchestrator` rather than calling the SSI adapter directly.
- [x] Inject the Supabase idempotency store only when `TCE_DURABLE_EXECUTION_IDEMPOTENCY_ENABLED=true`; default-off preserves safe rollout until the DB migration is applied.
- [x] If reservation storage is unavailable, do not call the provider and leave the order READY for retry.
- [x] If dispatch outcome cannot be durably recorded, return UNKNOWN and require reconciliation; never turn an ambiguous outcome into REJECTED.
- [x] Treat existing PENDING reservations as reconciliation-required and never redispatch.
- [x] Add orchestrator failure-boundary and Profit Exit service tests.
- [ ] Run backend build/tests and Prettier on the latest PR head, fix failures, and squash-merge this task.
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
- Envelope validation does not replace event-specific payload validation.
