# Runtime Boundary Standardization — implementation plan

**Repository:** `phanthienquoc/TCE-dashboard`  
**Tracking issue:** #845  
**PR:** #846 (draft)  
**Branch:** `feat/runtime-contract-standardization`  
**Base:** `master`

## Goal
Standardize ownership and provider/domain/event contracts incrementally without changing current strategy decisions or enabling live trading.

## Phase 0 — Baseline and architecture
- [x] Inventory platform, execution, risk, authorization and reconciliation contracts plus DRE architecture.
- [x] Add `docs/architecture/runtime-boundaries.md`.
- [x] Record safety assumptions.

## Phase 1 — Canonical event contract
- [x] Add `TceEventEnvelope` version 1, event-name/data map, and envelope structural guard.
- [x] Export the event contract from the existing `libs/contracts/src/index.ts` while preserving all prior exports.
- [x] Add tests for identity, schema version, timezone-aware timestamps, account/aggregate scope, sequence and data presence.
- [ ] Run tests/typecheck/build/lint; backend build is currently failing before unit tests run.

## CI findings / blocker
- Backend build job fails with a large set of `TS2305` missing exports from `@tce/contracts`, including exports already present in `master` (`CapitalPoolId`, `CONTRACT_TOKENS`, `TceExecutionIntent`, `AccountPosition`, etc.). The PR merge commit currently gives `libs/contracts/src/index.ts` only the two lines `tce-reconciliation` and `tce-event`; the latest branch file has been repaired to preserve the full export barrel. Re-run CI against the repaired branch head before attributing the baseline failures to this change.
- Prettier workflow rewrote 30 files outside this task and failed to push because the GitHub App lacks `workflows` permission when attempting to update `.github/workflows/wf-08b-tce-microfe-build-publish.yml`. Treat this as workflow tooling/configuration failure; do not include those unrelated formatting changes in this task.
- Current PR head needs refreshed checks after export-barrel repair. The PR is still draft; do not merge until the changed-file set and checks are verified.

## Phase 2 — Ownership boundaries
- Monitor: observations, snapshots, freshness/health and alert emission only.
- DRE: dividend campaigns, rolling sequence, settlement/T+2, continuity and GAP.
- TCE Core/`libs/tce-engine`: pure entry/risk/TP/quantity decisions; no DB/network/provider SDK or DRE import.
- Execution Orchestrator: command validation, account/environment scope, idempotency, authorization, dispatch and normalized result.
- Reconciliation: provider truth and drift/unknown outcome classification.
- [ ] Add import-boundary tests and migrate monitor event emission safely.

## Phase 3 — Unified transports
- [ ] REST uses canonical request/response/error DTOs.
- [ ] WebSocket and SSE publish identical typed/versioned event envelopes, differing only in framing.
- [ ] Add transport parity/compatibility tests.

## Phase 4 — Execution reliability
- [ ] Add durable idempotency persistence (the existing process-local cache is not sufficient across restart/replicas).
- [ ] Require account/environment scope, command fingerprint and authorization before non-PAPER dispatch.
- [ ] Unknown provider outcome -> reconciliation required; never blind retry.
- [ ] Test duplicates, conflicting fingerprints, timeout-after-dispatch, partial fill and provider outage.
- [ ] Keep live order submission out of this refactor.

## Phase 5 — Rollout
- [ ] Migrate behind compatibility adapters, preserve endpoints/DB compatibility, run validations and inspect diff.
- [ ] Keep a clean, reviewable squash-merge PR and verify deployment only after checks.

## Acceptance criteria
- One canonical event envelope and typed map in `libs/contracts`.
- Existing contract exports remain unchanged.
- Runtime DTO validation exists at external boundaries; envelope validation does not replace payload-specific validation.
- Strategy/DRE/monitor cannot bypass risk and execution authorization.
- REST/WS/SSE share event semantics and correlation IDs.
- Unknown outcomes require reconciliation, not blind retry.
