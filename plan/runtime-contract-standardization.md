# Runtime Boundary Standardization — implementation plan

**Repository:** `phanthienquoc/TCE-dashboard`  
**Tracking issue:** #845 (original), #849 (phase tracker)  
**Current task branch:** `feat/runtime-durable-idempotency`  
**Base:** `master`

## Goal

Standardize runtime ownership and provider/domain/event contracts incrementally without changing current strategy decisions or enabling live trading. Every task uses a dedicated branch and PR, runs CI on its latest head, fixes failures before merge, and squash-merges to `master`.

## Phase 0 — Baseline and architecture

- [x] Inventory existing platform, execution, risk, authorization and reconciliation contracts plus DRE architecture.
- [x] Add `docs/architecture/runtime-boundaries.md`.
- [x] Record safety assumptions and migration rules.

## Phase 1 — Canonical event contract

- [x] Add `TceEventEnvelope` schema version 1, typed event names/data, structural runtime validation, a known-event-name guard and a provider-neutral `TceEventPublisherPort`.
- [x] Preserve existing contract barrel exports and add the new event contract.
- [x] Add focused envelope tests for IDs, version, timestamps, scope, sequence and data.
- [x] Backend unit tests and Prettier passed on head `c6741f593af3c5193f85e37c9f1f3a6a0fbba4f3` (workflow runs #1898 and #1401).

## Phase 2 — Runtime ownership boundaries

- [x] Add static import-boundary tests for pure engine, TCE decision/scanner, Monitor and DRE provider dependencies.
- [ ] Migrate Monitor event emission safely behind the shared event contract; preserve snapshots, audit and cashout behavior and do not convert signals into orders.
- [ ] Confirm DRE campaign state remains in DRE, TCE core decisions remain in TCE Core, and only Execution Orchestrator dispatches commands.

## Phase 3 — Unified transports

- [ ] Map REST response/error DTOs to stable canonical error codes without breaking existing API responses.
- [ ] Implement REST/WebSocket/SSE adapters around the shared envelope/publisher port, using only existing runtime transport choices where available.
- [ ] Add parity/compatibility tests for version, event ID/type, account scope and correlation ID.

## Phase 4 — Execution reliability

- [x] Define a provider-neutral durable idempotency store port scoped by account/environment/key and command fingerprint.
- [x] Add an additive Supabase migration for durable reservation/result records.
- [x] Add a Supabase adapter which reserves composite scoped keys, rejects fingerprint conflicts and persists UNKNOWN as reconciliation-required.
- [x] Extend Execution Orchestrator to accept an injected durable store, fingerprint commands, reject conflicting reuse and avoid replaying PENDING/UNKNOWN records.
- [x] Add test coverage for same-key duplicates, conflicting fingerprints, separate accounts, and timeout/UNKNOWN behavior.
- [ ] Verify and wire durable-store injection on every production command-dispatch path before claiming production durability. At this checkpoint, the adapter is exposed by the Nest platform module but no production `new TceExecutionOrchestrator(...)` call site has been found outside tests; legacy in-memory behavior remains a compatibility path.
- [ ] Require account/environment scope, current authorization validation and risk/safety gate before any non-PAPER dispatch.
- [ ] Complete failure-matrix coverage for partial fill, provider outage and timeout-after-dispatch using provider truth/reconciliation.
- [ ] Never blindly retry unknown provider outcomes.

## Phase 5 — Rollout

- [ ] Keep migration additive and backward compatible; do not apply it to production automatically in this refactor.
- [ ] Run contract/unit tests, typecheck, build, lint and diff review on latest heads.
- [ ] Open a PR per task targeting `master`; merge only after required checks are green, always using squash.
- [ ] Verify deployment separately after code merge; this project work does not deploy or enable LIVE trading.

## Acceptance criteria

- [x] One canonical versioned event envelope and typed event map in `libs/contracts`.
- [x] Dependency rules have automated static tests.
- [x] Durable idempotency port, additive SQL schema and adapter exist on branch (CI/production wiring still pending).
- [ ] Existing Monitor behavior and public API compatibility are preserved during migration.
- [ ] REST/WS/SSE share event semantics and correlation IDs.
- [ ] Production dispatch uses durable idempotency and auth/scope checks.
- [ ] Unknown outcomes require reconciliation, not blind retry.

## Safety / rollout notes

- No live order submission, LIVE-mode enablement, production database migration, or deployment is authorized by this task.
- An adapter implementation is not proof of production use until the runtime path injects it.
- TypeScript types do not validate untrusted event payloads at runtime; envelope validation and event-specific validation remain separate.
