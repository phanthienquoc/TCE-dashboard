# Runtime Boundary Standardization — implementation plan

**Repository:** `phanthienquoc/TCE-dashboard`  
**Tracking issue:** #845  
**Branch:** `feat/runtime-contract-standardization`  
**Base:** `master`

## Goal
Remove ambiguous runtime ownership and standardize provider/domain/event contracts with backward compatibility. This work is additive first; production behavior and live trading are not enabled or mutated.

## Phase 0 — Baseline and architecture
- [x] Inspect current contracts, execution authorization/orchestration and DRE architecture.
- [ ] Add `docs/architecture/runtime-boundaries.md` ownership and dependency matrix.
- [ ] Capture current safety assumptions and test strategy.

## Phase 1 — Canonical event contract (initial implementation slice)
- [ ] Add `TceEventEnvelope` with explicit schema version, unique event identity, producer, correlation, occurrence time, optional account/aggregate/sequence context, and typed data.
- [ ] Add contract tests for identity, timestamp/version validation, account scope, and stable serialization.
- [ ] Reuse existing `ContractResult`, `MarketQuote`, `AccountBalance`, `AccountPosition`, `AccountOrder`, execution, risk, authorization and reconciliation types.
- [ ] Do not duplicate interfaces that already exist.

## Phase 2 — Single responsibility by runtime
- Monitor: collect/record observations, snapshots, freshness, health and alerts only.
- DRE: own dividend event campaigns, rolling sequence, settlement/T+2, continuity and GAP state.
- TCE Core: strategy entry, risk/TP/quantity decisions; no DRE dependency.
- Execution Orchestrator: validate command identity, enforce idempotency, authorize and dispatch provider operation.
- Reconciliation: query provider truth and classify drift/unknown outcomes.

## Phase 3 — Unified transports
- [ ] REST APIs use canonical request/response/error DTOs.
- [ ] WebSocket and SSE publish identical typed event envelopes, differing only in transport framing.
- [ ] Add parity/compatibility tests.

## Phase 4 — Reliability and security
- [ ] Add durable idempotency port/storage. The current in-process cache is not a multi-process/restart guarantee.
- [ ] Require account + environment scope, command fingerprint, and authorization before non-PAPER submission.
- [ ] Unknown provider outcome -> reconciliation required, never blind retry.
- [ ] Test duplicate request, conflicting fingerprint, timeout-after-dispatch, partial fill and provider outage.
- [ ] Keep live order submission out of this refactor.

## Phase 5 — Rollout
- [ ] Incremental migration behind compatibility adapters.
- [ ] Run test/typecheck/build/lint and inspect diff.
- [ ] One clean commit via squash merge into `master`, then verify CI/deploy.

## Acceptance criteria
See `docs/architecture/runtime-boundaries.md`. All new shared contracts are runtime-validated at external boundaries; strategy/DRE/monitor cannot bypass risk and execution authorization; endpoint/event consumers remain compatible; unknown outcomes require reconciliation.
