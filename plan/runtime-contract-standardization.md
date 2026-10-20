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

- [x] Add `TceEventEnvelope` schema version 1, typed event names/data, structural runtime validation, a known-event-name guard and a provider-neutral `TceEventPublisherPort`.
- [x] Preserve all existing contract barrel exports and add only `tce-event.contract`.
- [x] Add focused envelope tests for identity, version, timezone-aware timestamps, scope, sequence and required data.
- [x] Latest CI backend build passed.
- [x] CI run #1870 discovered and executed `TceEventEnvelope`; the contract spec passed. The overall backend suite remains red on unrelated existing assertions.

## Latest CI validation — 2026-10-20 (run #1891 / #1394)

- **Backend build:** passed on run #1893.
- **Node test group:** passed on run #1893, including contracts, SSI adapters, execution, reconciliation and the new architecture boundary spec.
- **Vitest group:** passed after fixing runner configuration and test fixture/import issues; run #1893 completed successfully.
- **Prettier workflow:** run #1396 passed. The formatter is limited to changed non-workflow files, and its auto-commit no longer tries to modify unrelated workflow YAML.
- **Test runner fixes:** `package.json` now routes `node:test` specs to Node and global-style Vitest specs to Vitest; `libs/contracts/src` is included. `vitest.config.ts` is dependency-free and maps `@tce/contracts` and `@tce/ssi` to source entry points for the npx runner.
- **Regression fixes:** SSI `RS` order status maps to `SUBMITTED`; CRDE execution computes BUY quantity/notional and requires explicit SELL quantity; SSI consolidated snapshots use margin fallback and exclude zero-quantity positions/orders; Telegram entry-zone parsing accepts double underscores; tests now use deterministic payment dates and valid strategy fixtures without changing the production dividend scoring/exit policy.
- **Merge gate:** PR #846 remains unmerged. Keep it draft while Phase 2–5 remain incomplete. No deployment or LIVE trading is enabled.

## Phase 2 — Runtime ownership boundaries

- Monitor: observation, snapshots, freshness/health and alerts only.
- DRE: dividend campaign, rolling sequence, settlement/T+2, continuity and GAP.
- TCE Core/`libs/tce-engine`: pure entry/risk/TP/quantity decisions; no DB/network/provider SDK or DRE import.
- Execution Orchestrator: command validation, account/environment scope, idempotency, authorization, dispatch and normalized result.
- Reconciliation: provider truth and drift/unknown-outcome classification.
- [x] Add static import-boundary tests for pure engine, TCE decision/scanner, Monitor and DRE provider dependencies.
- [ ] Migrate Monitor event emission safely behind the shared event contract.

## Phase 3 — Unified transports

- [ ] REST uses canonical request/response/error DTOs.
- [ ] Implement REST/WebSocket/SSE adapters over `TceEventPublisherPort` and prove identical typed/versioned event semantics; only framing differs.
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
