# Runtime Boundary Standardization — implementation plan

**Repository:** `phanthienquoc/TCE-dashboard`  
**Tracking issue:** #845  
**PR:** #846 (draft)  
**Branch:** `feat/runtime-contract-standardization`  
**Base:** `master`

## Goal
Standardize runtime ownership and provider/domain/event contracts incrementally without changing current strategy decisions or enabling live trading.

## Phase 0 — Baseline and architecture
- [x] Inventory existing platform, execution, risk, authorization and reconciliation contracts plus DRE architecture.
- [x] Add `docs/architecture/runtime-boundaries.md`.
- [x] Record safety assumptions and migration rules.

## Phase 1 — Canonical event contract
- [x] Add `TceEventEnvelope` schema version 1, typed event names/data, and structural runtime validation.
- [x] Preserve all existing contract barrel exports and add only `tce-event.contract`.
- [x] Add focused envelope tests for identity, version, timezone-aware timestamps, scope, sequence and required data.
- [x] Latest CI backend build passed.
- [ ] Contract test file is present but the global CI test step is red; isolated test execution still needs verification.

## Latest CI findings
- **Build:** passed on run #1863 after repairing the contract barrel. The earlier TS2305 flood happened on an intermediate merge snapshot with missing previous exports.
- **Tests:** failed with 15 of 147 tests red; the runner reported `ReferenceError: describe is not defined` for Vitest/Jest-style specs being run via Node's test runner, plus assertion failures in existing execution/reconciliation suites. This is repository test-runner/existing-suite debt, but the PR must still isolate and verify the new event contract test.
- **Prettier workflow:** format step passed; auto-push failed because the GitHub App lacks `workflows` permission for `.github/workflows/wf-08b-tce-microfe-build-publish.yml`. No unrelated formatter commit was pushed. Do not fix or reformat that workflow inside this contract-only change without separate permission/configuration handling.
- PR #846 remains draft; no merge/deploy is claimed.

## Phase 2 — Runtime ownership boundaries
- Monitor: observation, snapshots, freshness/health and alerts only.
- DRE: dividend campaign, rolling sequence, settlement/T+2, continuity and GAP.
- TCE Core/`libs/tce-engine`: pure entry/risk/TP/quantity decisions; no DB/network/provider SDK or DRE import.
- Execution Orchestrator: command validation, account/environment scope, idempotency, authorization, dispatch and normalized result.
- Reconciliation: provider truth and drift/unknown-outcome classification.
- [ ] Add import-boundary tests and migrate monitor event emission safely.

## Phase 3 — Unified transports
- [ ] REST uses canonical request/response/error DTOs.
- [ ] WebSocket and SSE publish identical typed/versioned event envelopes; only framing differs.
- [ ] Add transport parity/compatibility tests.

## Phase 4 — Execution reliability
- [ ] Add durable idempotency persistence. The current process-local cache is not sufficient across restarts/replicas.
- [ ] Require account/environment scope, command fingerprint and authorization before non-PAPER dispatch.
- [ ] Unknown provider outcome -> reconciliation required, never blind retry.
- [ ] Test duplicates, conflicting fingerprints, timeout-after-dispatch, partial fill and provider outage.
- [ ] Keep live order submission out of this refactor.

## Phase 5 — Rollout
- [ ] Migrate behind compatibility adapters and preserve current API/DB compatibility.
- [ ] Run isolated contract test, main tests, typecheck/build/lint and diff review.
- [ ] Keep a clean squash-merge PR and verify deployment only after checks.

## Acceptance criteria
- One canonical versioned event envelope and typed event map in `libs/contracts`.
- Existing contract exports remain unchanged.
- External DTO payloads are validated at runtime; envelope validation does not replace event-specific schema validation.
- Strategy/DRE/monitor cannot bypass risk and execution authorization.
- REST/WS/SSE share event semantics and correlation IDs.
- Unknown outcomes require reconciliation, not blind retry.
