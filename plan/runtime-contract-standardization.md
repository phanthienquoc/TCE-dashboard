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
- [x] CI run #1870 discovered and executed `TceEventEnvelope`; the contract spec passed. The overall backend suite remains red on unrelated existing assertions.

## Latest CI findings

- **Build:** passed on backend test run #1870.
- **Contract test:** `libs/contracts/src/tce-event.contract.spec.ts` was discovered and passed in run #1870.
- **Test runner:** fixed `package.json` so specs importing `node:test` run under Node's test runner and global `describe/expect` specs run under Vitest. Added `libs/contracts/src` to test discovery. This removed the `ReferenceError: describe is not defined` failures.
- **Remaining backend test failures:** run #1870 still fails on 12 existing assertions in SSI reconciliation/adapters, capital allocation, CRDE decision/execution, and dividend lifecycle tests. These are not caused by the event-envelope code; inspect and fix the underlying contract/fixture drift without weakening assertions or changing trading behavior blindly.
- **Prettier workflow:** run #1373 passed after changing the workflow to format only changed non-workflow files and stage only tracked formatting edits. This avoids the previous token rejection caused by trying to push unrelated `.github/workflows/wf-08b-tce-microfe-build-publish.yml` formatting changes.
- **Merge gate:** PR #846 remains draft and must not merge while any required check is red or missing. No deployment or LIVE trading is enabled.

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
