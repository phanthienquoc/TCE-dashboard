# Learning Curriculum — Cross-Layer Implementation Backlog

> Purpose: track shared design, infrastructure, service/backend, persistence and integration prerequisites discovered while applying learning tasks to the real TCE Dashboard. This is not a claim that every item below is already a confirmed defect; items marked **NEEDS AUDIT** must be verified against current source/configuration before implementation.

Use the shared contract in [Implementation Readiness Gate](../IMPLEMENTATION_READINESS.md). Prefer one item per shared system gap and link all lessons that depend on it.

## Status legend

- **NEEDS AUDIT** — inspect source/configuration and collect evidence before deciding.
- **READY** — prerequisites and acceptance criteria are confirmed.
- **BLOCKED** — evidence shows a missing dependency; include an explicit unblock condition.
- **IN PROGRESS / VERIFIED** — use only when implementation or verification evidence exists.

## Cross-layer items

### CURR-ARCH-01 — Map learning exercises to the real TCE architecture

- **Priority:** P0
- **Status:** VERIFIED — source mapping completed for the five Day 9–13 lesson files present in `docs/learning/`
- **Last source recheck:** 2026-10-30 against current master `5c193ff4da29ba895bca36a54cc927500b1068b9` after PR #969 merged.
- **Evidence:** [TCE Dashboard learning-to-source architecture map](../architecture-map.md), refreshed against current master; Day 10 quote validation is in `apps/web/lib/market-price-validation.ts`, pool-read cancellation is in `apps/web/lib/stock-dividend-pool-store.ts`, and stock-event cancellation is in `apps/web/lib/stock-event-store.ts` plus `apps/web/lib/app-data-worker.ts`. Telegram notification read cancellation is in `apps/web/lib/telegram-notification-data.ts` and the notifications list/detail/config consumers. Public Binance chart-history cancellation is in `apps/web/components/dashboard/BinanceRealtimeChart.tsx` and `apps/web/lib/binance-kline-history.ts`. Binance XAU panel read cancellation is in `apps/web/app/engines/BinanceXauTradingPanel.tsx` and `apps/web/lib/binance-xau-position-data.ts`. Dividend-position event-read cleanup is in `apps/web/components/dashboard/DividendPositionsView.tsx` and `apps/web/lib/dividend-positions-read-lifecycle.ts`. SSO session-exchange error reporting is in `apps/web/lib/keycloak-sso.ts`; it does not implement browser WebSocket authentication.
- **Boundary:** This verifies source-path/ownership mapping only. It does not mark Day 10–13 runtime requirements complete, and explicitly leaves WebSocket auth (`CURR-AUTH-07`), live schema/RLS/migration provenance (`CURR-DATA-04`), infra deployment details, and Day 13 profiling as unresolved.
- **Affected lessons:** Day 9–13 currently present in `docs/learning/`; link other curriculum days when their files are added/found.
- **Verified result:** The architecture map traces each existing Day 9–13 lesson to actual routes/components, API/store owners, service/event boundaries, and explicit N/A or unresolved layers. Missing Day 1–8 files remain tracked separately under `CURR-CATALOG-06`.
- **Maintenance:** Update the map when a source owner, route, API contract, event cursor, or readiness decision changes; re-verify every referenced path against the current base branch.
- **Acceptance:** MET for the five existing Day 9–13 files only: each lesson has source-backed entry points and affected layers, irrelevant layers are marked N/A with a reason, and unresolved contracts are explicit. Day 1–8 are not claimed reviewed.
- **Verification:** The architecture map and current source paths were rechecked against master `48e38425510d0703c731abc593b82215add0e599` after PR #966. PR #966 exact head `c6b2f244776ebccd213bc1edc1463386b28a2cd4` passed WF-01P `41046077194`, WF-02 `41046077210` and WF-05 `41046077243`; current-master WF-01 `41047499179`, WF-02 `41047499153` and WF-05 `41047499123` passed. No dedicated frontend regression spec was added for the new SSO message branch. The independent WF-03 production run `41047668004` is in progress; no rollout completion is claimed.

### CURR-INFRA-02 — Verify infrastructure prerequisites for service-level exercises

- **Priority:** P1
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 9–13 where a lesson introduces SSR, API transport, streams, caching, or profiling.
- **Gap to verify:** Document which exercises require only browser-local work and which require backend, deployment, network, secrets/configuration, or observability changes.
- **Work:** Inspect the current workflow, container/deployment manifests and runtime configuration relevant to each exercise. Do not change live infrastructure as part of this audit.
- **Acceptance:** Every infrastructure-affecting task has an environment scope, configuration owner, health/rollback check, and an explicit statement about whether deployment was actually verified.
- **Unblock condition:** Current manifests/workflows and ownership have been inspected and evidence is attached to the task/PR.

### CURR-SVC-03 — Verify service/API/event contracts before frontend-only implementation

- **Priority:** P0
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 10 REST cancellation; Day 11 realtime/recovery; Day 12 snapshot/event merge; Day 13 performance diagnosis.
- **Gap to verify:** Confirm actual endpoint and event producers/consumers, auth scope, versioning, timeout/retry behavior, cancellation semantics, event identity/order/cursor, and recovery source before modifying clients.
- **Verified slices (2026-10-30; not full acceptance):** PR #953 merged dividend-pool cancellation, generation guards, safe errors and worker signal forwarding. PR #955 merged stock-event cancellation, stale-response protection, safe errors and worker signal forwarding at `d79404e`. PR #955 exact-head frontend build run 41013983958, Prettier run 41013984089 and backend/root tests run 41013983940 passed; master checks 41014092643, 41014092714 and 41014092678 also passed. Tests are in `stock-dividend-pool-store.spec.ts`, `stock-event-store.spec.ts` and `app-data-worker.spec.ts`. `CURR-SVC-03` remains open because every API/event caller and end-to-end contract has not been audited.
- **Merged bounded slice (PR #957; merge `6b3beb546409358cf9cc1a8f000a4527f02255ab`):** `apps/web/lib/telegram-notification-data.ts` forwards a shared `AbortSignal` to existing Telegram bot/assignment GETs; notifications list/detail/config consumers abort on cleanup and guard stale commits. `apps/web/lib/telegram-notification-data.spec.ts` covers signal forwarding and response normalization. Exact PR head `052c301ad522d98802a13e88ed48c6a48c636de7` passed WF-01P #41024683065, WF-02 #41024683023 and WF-05 #41024682994 before merge. Post-merge status was not surfaced by the available connector, so it remains unverified. This is one bounded client read-lifecycle slice, not proof that all API callers or end-to-end contracts are audited.
- **Merged bounded slice (PR #961; merge `53b70f907eb24462db207269ddc2092e9c6563c3`):** `EngineControlPanel.tsx` now owns an `AbortController` for engine status/configuration GETs, passes the same signal through `apps/web/lib/engine-control-data.ts`, aborts on effect cleanup/restart and blocks stale state/loading commits. `engine-control-data.spec.ts` covers signal sharing, aborting both pending reads and empty payload normalization. Exact PR head `ec240d8662597b3982263fe74b7071a76a26e735` passed WF-01P #41030892797, WF-02 #41030892857 and WF-05 #41030892904 (253 passed, 0 failed). Post-merge status for `53b70f9` was not surfaced; no production deployment is claimed. `CURR-SVC-03` remains open.
- **Merged bounded slice (PR #963; merge `086d5370f80128e20683dc792f3f02c7608015e3`):** `apps/web/components/dashboard/BinanceRealtimeChart.tsx` now aborts its public Binance kline-history fetch when the effect is disposed or its inputs change. `apps/web/lib/binance-kline-history.ts` owns the request URL/query and forwards the signal; `binance-kline-history.spec.ts` covers query bounds, signal propagation/abort, and HTTP 429 handling. Exact PR head `d18f18464a4b8ed151fbc2a6b304f56e126821b2` passed WF-01P `41037561091`, WF-02 `41037561173`, and WF-05 `41037561127`; the three new Node tests passed and Vitest reported 23 files / 101 tests passed. Post-merge status for `086d537` remains unverified. `CURR-SVC-03` remains open.
- **Merged bounded slice (PR #965; merge `ff274e77bcd5d6c835654b96423342061a3d0df2`):** `BinanceXauTradingPanel.tsx` now aborts its existing config/Telegram-bot reads on effect cleanup and account identity changes, clears account-local view state before reloading, and aborts the position poll on account/environment cleanup. Polls are sequential, so slow reads do not stack. `api.ts` forwards optional signals to the existing config/position GETs while preserving the environment header; `binance-xau-position-data.ts` retains the existing open-position selection rule. Tests in `binance-xau-position-data.spec.ts` cover signal/environment forwarding, selection, empty/malformed responses and intentional cancellation; `dashboard-cancellation.spec.ts` verifies the Axios signals and testnet header. Exact PR head `8726c7f4d0287e50fab42a60dbb1826761314c53` passed WF-01P `41045939056`, WF-02 `41045938623`, WF-05 `41045938628`; post-merge master `ff274e77bcd5d6c835654b96423342061a3d0df2` passed WF-01 `41046146755`, WF-02 `41046146855` and WF-05 `41046146842`. WF-01 verifies images/config/YAML only; no deployment is claimed. `CURR-SVC-03` remains open.
- **Merged bounded slice (PR #969; merge `5c193ff4da29ba895bca36a54cc927500b1068b9`):** `apps/web/components/dashboard/DividendPositionsView.tsx` now starts the existing stock-event refresh through `apps/web/lib/dividend-positions-read-lifecycle.ts` and aborts the effect-owned signal on cleanup. `dividend-positions-read-lifecycle.spec.ts` verifies the preserved `load(2000, true, null, signal)` arguments and cleanup abort; existing `stock-event-store.spec.ts` covers transport cancellation and stale-response protection. Exact PR head `9b67809a932cf46e7f9ac1e7d6263904616314a4` passed WF-01P `41048947556`, WF-02 `41048947517`, WF-05 `41048947521` and WF-11 `41048947442`. Combined-status/workflow queries returned no post-merge records for `5c193ff`, so post-merge verification remains WARN, not PASS; no deployment is claimed. Source inspection also found a pre-existing contract mismatch: the UI requests limit 2000 while `StockEventsService.getUpcoming` clamps the response limit to 200. This is intentionally not changed by the cancellation PR and needs a separate requirements/contract decision. `CURR-SVC-03` remains open.
- **Work:** Trace existing service handlers and frontend consumers; write down contract gaps only where source evidence demonstrates them.
- **Acceptance:** No lesson claims end-to-end behavior based only on a client hook, mock, type, or unit test. Required service changes have an identified owner and integration test path.
- **Unblock condition:** Relevant producer and consumer contracts are located and the intended behavior is agreed/documented.

### CURR-DATA-04 — Verify persistence and versioning assumptions

- **Priority:** P1
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 11–12 and any exercise requiring durable replay, snapshot/event ordering, deduplication, or cache reconciliation.
- **Gap to verify:** Establish whether required IDs, versions, timestamps, cursors and persistence guarantees exist today; do not assume database changes are necessary or safe.
- **Work:** Inspect current data models, schema/migrations, RLS, and service contracts. Record whether the exercise can use existing contracts or needs a separately planned change.
- **Acceptance:** Stale-snapshot rejection and recovery behavior have a documented source-of-truth/version rule and deterministic tests. Any schema/RLS change has its own compatibility, security and rollback review.
- **Unblock condition:** Current persistence and ordering guarantees are verified; unresolved guarantees become a specific follow-up item.

### CURR-VERIFY-05 — Add end-to-end evidence to implementation completion

- **Priority:** P0
- **Status:** READY
- **Affected lessons:** All learning lessons.
- **Work:** Apply the readiness checklist; choose verification proportional to impact: unit/component, API/contract, integration, build/CI, deployment/runtime, and performance profiling as applicable.
- **Acceptance:** Completion reports separate implemented, integrated, CI-verified, environment-verified and production-verified states; no claim exceeds the evidence.
- **Safety:** Do not use a live order, production schema mutation, or production rollout as a test fixture.

### CURR-CATALOG-06 — Reconcile curriculum file inventory

- **Priority:** P1
- **Status:** BLOCKED
- **Affected lessons:** Day 1–13 curriculum inventory.
- **Evidence:** The repository's `docs/learning/` directory on the audited branch contains Day 9, Day 10, Day 11, Day 12 and Day 13 lesson files only. The first eight day-specific Markdown files are not present in that directory listing at the time of this audit.
- **Work:** Locate the canonical Day 1–8 lesson source or restore/create those files from the authoritative curriculum before claiming all 13 lesson files have been reviewed. Do not fabricate lesson content or mark missing files reviewed.
- **Acceptance:** A checked-in index lists the canonical path for each Day 1–13 lesson and links the readiness gate; all listed files exist.
- **Unblock condition:** The canonical source for Day 1–8 is located or the owner confirms they should be created anew.

### CURR-AUTH-07 — Establish a secure browser WebSocket authentication handshake

- **Priority:** P1
- **Status:** BLOCKED
- **Affected lessons:** Day 11 realtime/recovery and Day 12 cache/stream integration.
- **Evidence:** In master, `apps/web/lib/api.ts` attaches the in-memory access token only to Axios requests; the browser WebSocket constructor in the unmerged PR #936 did not carry an Authorization header. `apps/service/src/runtime-events/runtime-events.websocket.ts` accepts a Bearer header or a cookie that it introspects through `AUTH_SERVICE_URL`. The auth refresh cookie is configured with `Path=/api/auth`; the actual socket host/path cookie scope has not been verified. An authenticated HTTP preflight does not authenticate a later WebSocket upgrade.
- **Adjacent merged change (PR #966; merge `48e38425510d0703c731abc593b82215add0e599`):** `apps/web/lib/keycloak-sso.ts` now reads a non-empty string `message` from failed session-exchange responses and otherwise uses status-specific fallback text for 401/403/other errors. PR #966 passed exact-head WF-01P/WF-02/WF-05, but it changed only this file and added no dedicated frontend regression spec. This is user-facing SSO error reporting, not browser WebSocket upgrade authentication; `CURR-AUTH-07` remains BLOCKED.
- **Work:** Inspect the real production host, reverse-proxy route, cookie domain/path/SameSite settings, and browser session lifecycle. Choose and document a secure handshake compatible with browser WebSocket APIs before implementing the frontend quote stream. Consider a verified same-origin HttpOnly cookie contract or a short-lived, single-use channel credential transported outside the URL; do not put access/refresh bearer tokens in URLs.
- **Acceptance:** The design has a sequence diagram and identifies credential issuer, transport, expiry/replay protection, origin validation, account binding, logging/redaction, and rollback. An integration test proves the actual browser-to-socket identity path, rejects unauthenticated/expired/replayed credentials and disallowed origins, and proves the client cannot select another account. No stream is marked integrated based only on a successful HTTP preflight or mocked WebSocket.
- **Unblock condition:** Deployment routing and cookie scope are verified, the handshake design is reviewed, and the integration-test owner/environment are identified. Any persistence or schema needed for one-time credentials gets a separate readiness review.

**Proposed handshake sequence — design target only; not implemented:**

```mermaid
sequenceDiagram
  participant Browser
  participant Auth as Authenticated HTTP API
  participant WS as Runtime Events WebSocket
  Browser->>Auth: Request channel authorization using existing session
  Auth-->>Browser: Approved secure handshake mechanism
  Browser->>WS: Upgrade using supported credential channel (not URL bearer token)
  WS->>Auth: Validate identity, origin, expiry and replay policy
  Auth-->>WS: Authenticated account identity
  WS-->>Browser: Open account-scoped read-only stream
```

## Day-specific follow-up

- **Day 13 performance:** `PERF-13-01` actual consumer/source map is complete via PR #952 and recorded in [Day 13 performance implementation backlog](day13-performance-profiling-implementation-backlog.md). The next gates are a reproducible `PERF-13-02` baseline and `PERF-13-03` measurable correctness/performance acceptance before any optimization.
- **Day 9–12:** Add specific items only when source inspection demonstrates a concrete missing contract, service capability, infrastructure requirement, or test harness. Avoid speculative migrations and duplicate backlog entries.
