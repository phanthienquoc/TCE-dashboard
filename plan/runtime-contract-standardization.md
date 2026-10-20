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

- [ ] Define canonical REST result/error DTO semantics with compatibility mapping to existing API responses.
- [ ] Implement REST/WebSocket/SSE adapters around the same event envelope and publisher contract, using supported/current transport infrastructure rather than inventing a second bus.
- [ ] Add transport parity/compatibility tests for event ID/type/version, account scope, correlation ID and error classification.
- [ ] Validate external payloads at runtime; TypeScript typing alone is not validation.

## Phase 4 — Execution reliability

- [x] Define provider-neutral durable idempotency store port scoped by account/environment/key/fingerprint.
- [x] Add an additive SQL migration for reservations and persisted results; table RLS is enabled and direct client-role access is revoked.
- [x] Squash-merge durable idempotency foundation PR #851 at `caa64bd4ebaf2cc99b966c2cfe606bfcbf8f689d` after backend run #1903 and Prettier run #1406 passed.
- [x] Add a Supabase adapter with unique composite reservation keys, fingerprint conflict detection, guarded `PENDING` completion and durable `UNKNOWN` status.
- [x] Extend Execution Orchestrator with deterministic command fingerprints, optional durable-store injection, conflicting-key rejection and no replay of existing `PENDING`/`UNKNOWN` reservations.
- [x] Add focused tests for duplicate keys, conflicting fingerprints, separate account scopes, persisted results and unknown outcomes.
- [ ] Wire the durable store into the actual production execution entry point. The current repository has no production construction site for `TceExecutionOrchestrator` outside tests; merely registering a DI provider is not proof of production use.
- [ ] Enforce account/environment scope, current authorization validation and risk/safety gate before any non-PAPER dispatch.
- [ ] Complete failure-path tests for timeout-after-dispatch, partial fills, provider outage, persistence failure, and reconciliation from provider truth.
- [ ] Ensure unknown outcomes require reconciliation and can never be blindly resubmitted.

## Phase 5 — Rollout

- [ ] Keep schema change additive and backward compatible; do not apply the migration automatically to production.
- [ ] Run event/contract tests, Node and Vitest suites, service/web typecheck, backend build, lint and diff review on each latest PR head.
- [ ] Open a separate PR per task, with required CI green before squash merge into `master`.
- [ ] Verify deployments separately after code is merged; this implementation does not deploy or enable LIVE trading.

## Current task: Monitor event emission

- [x] Add `SupabaseRuntimeEventPublisher` implementing the shared `TceEventPublisherPort`.
- [x] Add an RLS-protected `tce_runtime_events` outbox migration; grant access only to `service_role`.
- [x] Emit `monitor.snapshot.created` after snapshot persistence with a deterministic event ID and account/correlation metadata.
- [x] Register the Monitor module with explicit scheduler opt-in (`TCE_MONITOR_SCHEDULER_ENABLED=true`) so module registration alone cannot start the legacy scheduler.
- [x] Add contract/publisher/failure-isolation unit tests.
- [ ] Verify CI and squash-merge this task.

## Previous task: durable idempotency store

- [x] Contract, adapter, RLS migration, Nest provider and duplicate/conflict/unknown tests implemented.
- [x] Squash-merged as PR #851 into `master` after backend build/tests and Prettier passed.
- [ ] Production runtime injection remains incomplete until a real dispatch call site is identified and tested.

## Acceptance criteria

- [x] One canonical versioned event envelope and typed event map in `libs/contracts`.
- [x] Boundary ownership is documented and import-boundary tests exist.
- [x] Durable idempotency port, SQL schema and adapter exist.
- [x] Monitor emits through the shared event contract without gaining order-dispatch authority.
- [ ] REST/WS/SSE share event semantics and correlation IDs.
- [ ] Production dispatch uses durable idempotency and verified authorization/scope checks.
- [ ] Unknown outcomes require reconciliation, not blind retry.
- [ ] Compatibility and rollout gates pass before production migration/deployment.

## Safety notes

- Migration `202610210002_tce_runtime_events.sql` is additive and has not been applied to production.
- Monitor scheduling stays off unless `TCE_MONITOR_SCHEDULER_ENABLED=true`; manual invocation remains protected by `TCE_MONITOR_RUN_SECRET`.
- No live order submission, LIVE-mode enablement, production DB migration, or deployment is authorized by this refactor.
- An adapter implementation or Nest provider is not proof of runtime durability until the actual dispatch path injects and uses it.
- Envelope validation does not replace event-specific payload validation.
