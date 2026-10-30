# TCE Dashboard — Learning-to-Source Architecture Map

**Task:** `CURR-ARCH-01` — Map learning exercises to the real TCE architecture  
**Readiness:** `PARTIALLY READY` for source mapping; `NO-GO` for any new auth/SSR/DB/runtime contract changes inferred from this map  
**Audited source baseline:** `master` at `d79404ec62250ddf2762620f6819318daf029412` (2026-10-30)  
**Purpose:** Trace the existing Day 9–13 learning notes to actual repository entry points and owners. This map records what source establishes and explicitly labels unresolved contracts; it does not claim every lesson's desired behavior is complete.

## System Readiness Check

| Area                      | Status                                       | Evidence                                                                                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                     | PASS                                         | First backlog item `CURR-ARCH-01`; current `docs/learning/` contains Day 9–13 lesson files plus readiness/backlog documents.                                                                                                                                              |
| Git/base                  | PASS                                         | Rechecked against `master` `d79404e` after PR #955 added stock-event read cancellation; PR #952 completed the Day 13 source-call-site map and PR #951 completed account-cache invalidation. PR #949 quote validation and PR #953 pool-read lifecycle are also on master. |
| Existing PR overlap       | PASS                                         | PR #955 is merged at `d79404e`. The only open PR is draft #928, limited to `plan/agentic-task-queue.md`; it does not overlap learning files. The browser quote-stream proposal in PR #936 remains closed unmerged. |
| Source ownership          | PASS for mapped frontend/runtime paths       | Verified App Router layout/pages/providers, centralized API client, dashboard, dividend-pool and stock-event stores, account-cache clear path, app-data worker, WebSocket client, and runtime-events controller/query service. |
| Build/test baseline       | WARN                                         | PR #955 exact head passed frontend build 41013983958, Prettier 41013984089 and backend/root tests 41013983940. Master `d79404e` has successful backend tests 41014092643, image/config verification 41014092714 and auto-format 41014092678; duplicate runs were cancelled/skipped. |
| Infrastructure/deployment | N/A for this documentation-only task         | No manifests, workflow, service configuration or deployment was changed. Re-check them before SSR/runtime/deployment changes.                                                                                                                                             |
| Secrets/permissions       | N/A for this documentation-only task         | No credentials accessed or changed. Required presence/access must be verified before tasks that need them; never print values.                                                                                                                                            |
| Database/migrations       | WARN / unresolved                            | Runtime-events query code reads `tce_runtime_events` through Supabase. This mapping did not verify live schema, migration ledger or RLS. Track under `CURR-DATA-04` and existing Supabase migration-provenance work; no DB changes are authorized.                        |
| Production risk           | PASS for mapping only                        | No runtime, auth, data, trading, configuration or production behavior changed.                                                                                                                                                                                            |

### Readiness decision

**PARTIALLY READY:** the existing source map can be recorded safely. Runtime changes that depend on browser-to-WebSocket authentication, SSR session propagation, database/RLS guarantees, or deployment behavior remain blocked until their owning contracts are verified. This is not a blanket GO for all learning tasks.

## 1. Current architecture

```mermaid
flowchart TD
  Browser[Browser / mobile UI]
  Layout[apps/web/app/layout.tsx<br/>RootLayout]
  Providers[apps/web/app/providers.tsx<br/>Client AppProviders]
  Routes[App Router]
  Redirect[/dashboard/page.tsx<br/>redirect to /overview]
  Overview[/overview/page.tsx<br/>Client Component]
  Shell[DashboardShell + OverviewView]
  Auth[useAuthStore / session-token]
  API[apps/web/lib/api.ts<br/>Axios API + authClient]
  DashboardStore[useDashboardStore<br/>apps/web/lib/store.ts]
  PriceValidator[normalizeMarketPricePayload<br/>apps/web/lib/market-price-validation.ts]
  TCEStore[useTCEDataStore<br/>apps/web/lib/tce-data-store.ts]
  Service[apps/service API]
  RuntimeEvents[Runtime Events Controller]
  RuntimeQuery[RuntimeEventsQueryService]
  Supabase[(Supabase persistence<br/>schema/RLS not audited here)]
  WSClient[microfe-ws.ts]
  WSService[runtime-events.websocket.ts<br/>auth handshake contract must be verified]

  Browser --> Layout --> Providers --> Routes
  Routes --> Redirect
  Routes --> Overview --> Shell
  Providers --> Auth
  Providers --> WSClient
  Shell --> DashboardStore
  Shell --> TCEStore
  DashboardStore --> API
  TCEStore --> API
  API --> Service
  DashboardStore -. "untrusted quote payload" .-> PriceValidator
  PriceValidator -. "accepted rows + rejection counts" .-> DashboardStore
  WSClient -. "separate upgrade/auth contract" .-> WSService
  Service --> RuntimeEvents --> RuntimeQuery --> Supabase
  WSService --> RuntimeQuery
```

### Verified source ownership

| Concern                      | Current source / symbol                                                                                                                        | Verified behavior / boundary                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root App Router shell        | `apps/web/app/layout.tsx` — `RootLayout`                                                                                                       | Imports global styles and wraps route children in `AppProviders`.                                                                                                                                                                     |
| Global browser providers     | `apps/web/app/providers.tsx` — `AppProviders`                                                                                                  | Client Component; owns theme/toast and mounts WebSocket/system-update bridges.                                                                                                                                                        |
| Dashboard entry              | `apps/web/app/dashboard/page.tsx` — `DashboardPage`                                                                                            | Server-side route module redirects to `/overview`; it does not fetch dashboard data.                                                                                                                                                  |
| Overview page                | `apps/web/app/overview/page.tsx` — `OverviewPage`                                                                                              | Client Component composing `DashboardShell` and `OverviewView`. This is consistent with interactive Zustand/browser/realtime ownership; no SSR migration is justified by this lesson alone.                                           |
| HTTP transport               | `apps/web/lib/api.ts` — `api`, `authClient`, `dashboardApi`, `platformApi`                                                                     | Centralized Axios instances, credentials, request timeout, auth refresh/retry, CSRF handling and optional `AbortSignal` on selected reads.                                                                                            |
| Dashboard state              | `apps/web/lib/store.ts` — `useDashboardStore`; `apps/web/lib/market-price-validation.ts` — `normalizeMarketPricePayload`                       | Owns dashboard state including `marketPrices: Record<string, MarketPrice>`; market-price sync validates requested symbols and finite positive numeric prices before state updates.                                                    |
| TCE prefetch state           | `apps/web/lib/tce-data-store.ts` — `useTCEDataStore`                                                                                           | Owns several prefetched API response collections; uses an `AbortController` and generation guard so cleared/superseded prefetches do not write stale results.                                                                         |
| API error handling           | `apps/web/lib/api-errors.ts`, `api-errors.spec.ts`                                                                                             | Shared API error normalization/cancellation classification. Verify call-site UX behavior before claiming every route has consistent error UI.                                                                                         |
| Cancellation evidence        | `apps/web/lib/dashboard-cancellation.spec.ts`; `apps/web/lib/stock-event-store.spec.ts`                                                                 | Dashboard cancellation tests cover their request path; stock-event tests cover clear/late response, worker abort and safe errors. Tests alone do not prove every consumer is correctly wired. |
| Dividend-pool read lifecycle | `apps/web/lib/stock-dividend-pool-store.ts`; `apps/web/lib/app-data-worker.ts`; `stock-dividend-pool-store.spec.ts`; `app-data-worker.spec.ts` | Pool reads pass an optional `AbortSignal`, abort superseded requests, ignore obsolete generations and normalize safe errors. Worker clear aborts the pool read; API/auth/schema contracts are unchanged. |
| Browser WebSocket client     | `apps/web/lib/microfe-ws.ts`, `microfe-ws.spec.ts`                                                                                             | Owns reconnect/heartbeat/subscription/sequence-gap handling. Reconnect delay is bounded with jitter; retry counter resets only after a stable connection.                                                                             |
| WebSocket lifecycle bridge   | `apps/web/app/providers.tsx` — `MicrofeWebSocketBridge`                                                                                        | Starts the client only when auth store reports authenticated; stops it otherwise. This alone does not establish how the HTTP session is authenticated during the WS upgrade.                                                          |
| SSE/runtime event HTTP API   | `apps/service/src/runtime-events/runtime-events.controller.ts`                                                                                 | Derives account from Bearer JWT, validates cursor/event type/limit, exposes list and SSE routes.                                                                                                                                      |
| Durable event cursor         | `apps/service/src/runtime-events/runtime-events.query.service.ts`                                                                              | Queries `tce_runtime_events` with account scoping and timestamp/event-id cursor ordering; resolves `Last-Event-ID` only within the authenticated account.                                                                             |
| WebSocket server             | `apps/service/src/runtime-events/runtime-events.websocket.ts`                                                                                  | Actual server-side upgrade/auth contract must be reviewed before enabling a browser-to-service stream; see `CURR-AUTH-07` in the backlog.                                                                                             |
| Performance consumers        | `apps/web/lib/store.ts`, `apps/web/lib/tce-data-store.ts`, real dashboard components under `apps/web/components/dashboard/` | PERF-13-01 source mapping is complete in the Day 13 backlog and PR #952. This is a source map, not a profile; it identifies candidate broad subscriptions/row rebuilding but does not establish a dominant bottleneck. PERF-13-02/03 remain open. |
| Stock-event read lifecycle    | `apps/web/lib/stock-event-store.ts`; `apps/web/lib/app-data-worker.ts`; `apps/web/lib/stock-event-store.spec.ts`; `apps/web/lib/store.ts` | PR #955 adds internal abort/generation guards, forwards the worker signal and normalizes safe read errors; `clearAccountScopedStores()` clears this store on logout/account change. The authenticated endpoint contract is unchanged. |

## 2. Mapping existing learning documents

| Lesson                                        | Actual entry points / source owners                                                                                                                                                                                                                                                                                             | Relevant layers                                                                                                                                                                                                                                                                  | Readiness / unresolved work                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Day 9 — Next.js architecture                  | `app/layout.tsx`, `app/providers.tsx`, `app/dashboard/page.tsx`, `app/overview/page.tsx`, `components/dashboard/DashboardShell`, `components/dashboard/DashboardViews`, `lib/api.ts`                                                                                                                                            | System design: PASS for current boundary map. Frontend: PASS. Service/API: centralized client identified. Infra: N/A for the mapping task; inspect before SSR/runtime change. DB: N/A unless data-access boundary changes. Integration: route/provider/auth relationship mapped. | No explicit requirement currently justifies migrating `/overview` to Server Components. Preserve browser-owned auth/state/realtime until a full server session contract is designed.                                                                                                                                                 |
| Day 10 — REST errors/cancellation             | `lib/api.ts`, `lib/api-errors.ts`, `lib/store.ts`, `lib/market-price-validation.ts`, `lib/tce-data-store.ts`, `lib/stock-dividend-pool-store.ts`, `lib/stock-event-store.ts`, `lib/app-data-worker.ts` and related specs | Frontend/service contract. Infra and DB: N/A for these bounded read-lifecycle fixes. | Safe error normalization, dashboard cancellation, quote validation, dividend-pool and stock-event cancellation/stale-response guards are present on master. PR #953 merged pool-read lifecycle; PR #955 merged stock-event cancellation at `d79404e`. PRs #938/#939 were test-only; broader API-read caller audit remains open. |
| Day 11 — WebSocket/SSE/reconnect/backpressure | `lib/microfe-ws.ts`, `lib/microfe-ws.spec.ts`, `app/providers.tsx`, `apps/service/src/runtime-events/runtime-events.controller.ts`, `runtime-events.query.service.ts`, `runtime-events.websocket.ts`                                                                                                                            | Frontend transport, backend service, auth boundary, persistence cursor and integration. Infra: not verified in this mapping. DB: durable table contract/RLS not verified here.                                                                                                   | Reconnect backoff and account-scoped SSE cursor are present on master. Browser WS authentication/upgrade remains blocked by `CURR-AUTH-07`; do not create/enable a quote stream until secure handshake is established. Queue/backpressure behavior must be inspected before claiming complete.                                       |
| Day 12 — Normalization/cache                  | `lib/store.ts`, `lib/tce-data-store.ts`, `lib/account-cache-isolation.spec.ts`, API response contracts and runtime event cursor service | Frontend state ownership, identity, invalidation, account isolation and snapshot/event consistency. DB: inspect only for a concrete version/cursor requirement. | PR #951 clears account-scoped stores before logout settles or after identity changes; regression tests are merged. Dashboard `marketPrices` remains symbol-keyed and no universal snapshot watermark is established, so ordering/reconciliation remains unresolved. |
| Day 13 — Performance profiling                | `lib/store.ts`, `lib/tce-data-store.ts`, actual dashboard components, `docs/learning/backlog/day13-performance-profiling-implementation-backlog.md` | Frontend rendering/state; browser profiling. Service/DB/infra are N/A until measurement points to those layers. | PERF-13-01 source mapping is complete via PR #952; PERF-13-02 reproducible profiling baseline and PERF-13-03 measured acceptance criteria remain open. No speculative memoization/virtualization. |

## 3. Data and event flow — current known contract

```mermaid
sequenceDiagram
  participant UI as Overview / Dashboard UI
  participant Store as Zustand stores
  participant API as Central Axios client
  participant Service as Authenticated service API
  participant Query as RuntimeEventsQueryService
  participant DB as Supabase runtime event store
  participant SSE as Runtime Events SSE

  UI->>Store: subscribe/read state
  Store->>API: dashboard/prefetch request (+ optional AbortSignal)
  API->>Service: authenticated HTTP request
  Service-->>API: response / normalized error
  API-->>Store: resolve or reject
  Store-->>UI: state update
  SSE->>Service: request with Bearer JWT and cursor
  Service->>Query: resolve cursor / list account events
  Query->>DB: account-scoped cursor/list query
  DB-->>Query: ordered events
  Query-->>Service: event envelopes
  Service-->>SSE: SSE events with resumable event IDs
  Note over UI,SSE: Browser WS upgrade authentication is a separate unresolved contract; do not assume SSE auth automatically works for WebSocket.
```

## 4. Contract warnings found during mapping

1. **WebSocket auth is a hard blocker.** The browser bridge checks the local auth-store status, but that is not proof that the WebSocket upgrade sends credentials accepted by the server. Existing backlog item `CURR-AUTH-07` is the canonical blocker. No token-in-query or other credential transport is selected by this mapping.
2. **Database provenance is not verified by reading the service query.** The query code demonstrates the intended table and account filter, but does not prove current production schema, RLS policy, migration provenance or operational availability. Use `CURR-DATA-04` and the existing Supabase migration-provenance work before persistence changes.
3. **Verify the actual auth transport across the HTTP and WebSocket boundaries.** `apps/web/lib/session-token.ts` keeps the short-lived access token in memory; `apps/web/lib/api.ts` attaches a Bearer header and also enables credentials, while refresh credentials are HttpOnly. This does not prove the browser WebSocket upgrade carries a credential accepted by the server. Verify cookie host/path/SameSite and the real upgrade handshake under `CURR-AUTH-07`; do not change auth behavior in this architecture-mapping task.
4. **Day 13 has no verified performance baseline.** PERF-13-01 source mapping is complete; the backlog still requires a reproducible profile and measured acceptance criteria before runtime optimization.
5. **Quote validation is display-boundary validation only.** `market-price-validation.ts` protects the dashboard store from malformed or unrequested quote rows; it is not an order/risk/execution gate and does not replace backend validation or server-authoritative reconciliation.

## 5. Task ordering after CURR-ARCH-01

1. **Day 9:** architecture mapping is now source-backed. No runtime change is warranted solely to force a Server Component conversion.
2. **Day 10:** quote payload validation is merged and CI-verified. Continue only if source audit finds a concrete remaining API read/error/loading gap; preserve centralized auth, stale-response protection and user-visible state.
3. **Day 11:** keep WebSocket transport integration blocked until `CURR-AUTH-07` is resolved. Continue only independent safe tasks, such as verifying current SSE cursor/replay and existing client gap behavior.
4. **Day 12:** account-scoped cache clearing is implemented and tested by PR #951; continue only with snapshot/event ordering, producer watermark/version and replay guarantees under `CURR-DATA-04`.
5. **Day 13:** `PERF-13-01` source mapping is complete via PR #952; capture `PERF-13-02` baseline and define `PERF-13-03` acceptance before choosing an optimization.

## Completion boundary

This document maintains the **source mapping/audit task** for the five existing lesson files against master `d79404e`. Day 10 has several bounded runtime slices merged, but broader API-read coverage remains open; Day 11 browser WebSocket auth, Day 12 snapshot/event ordering, Day 13 profiling, live database state and production verification are not complete.

## Maintenance

Update this map whenever a source owner, route, API contract, event cursor, or readiness decision changes. Re-verify referenced paths against the current base branch.
