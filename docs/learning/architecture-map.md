# TCE Dashboard — Learning-to-Source Architecture Map

**Task:** `CURR-ARCH-01` — Map learning exercises to the real TCE architecture  
**Readiness:** `PARTIALLY READY` for source mapping; `NO-GO` for any new auth/SSR/DB/runtime contract changes inferred from this map  
**Audited source baseline:** `master` at `086d5370f80128e20683dc792f3f02c7608015e3` (2026-10-30; PR #963 merged)  
**Purpose:** Trace the existing Day 9–13 learning notes to actual repository entry points and owners. This map records what source establishes and explicitly labels unresolved contracts; it does not claim every lesson's desired behavior is complete.

## System Readiness Check

| Area                      | Status                                 | Evidence                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                     | PASS                                   | First backlog item `CURR-ARCH-01`; current `docs/learning/` contains Day 9–13 lesson files plus readiness/backlog documents.                                                                                                                       |
| Git/base                  | PASS / WARN                            | master=086d537 after PR #963. Exact PR #963 head d18f184 passed WF-01P #41037561091, WF-02 #41037561173 and WF-05 #41037561127; post-merge status for 086d537 remains unverified.                                                                  |
| Existing PR overlap       | PASS                                   | PR #961 is merged. The only open PR is draft #928, limited to `plan/agentic-task-queue.md`; no overlap with learning files. PR #936 remains closed unmerged.                                                                                       |
| Source ownership          | PASS for mapped frontend/runtime paths | Verified App Router layout/pages/providers, centralized API client, dashboard, dividend-pool and stock-event stores, account-cache clear path, app-data worker, WebSocket client, and runtime-events controller/query service.                     |
| Build/test baseline       | PASS / WARN                            | PR #961 exact head `ec240d8` passed WF-01P #41030892797, WF-02 #41030892857 and WF-05 #41030892904 (253 tests passed, 0 failed). Post-merge status for `53b70f9` was not surfaced; no deployment claim.                                            |
| Infrastructure/deployment | N/A for this documentation-only task   | No manifests, workflow, service configuration or deployment was changed. Re-check them before SSR/runtime/deployment changes.                                                                                                                      |
| Secrets/permissions       | N/A for this documentation-only task   | No credentials accessed or changed. Required presence/access must be verified before tasks that need them; never print values.                                                                                                                     |
| Database/migrations       | WARN / unresolved                      | Runtime-events query code reads `tce_runtime_events` through Supabase. This mapping did not verify live schema, migration ledger or RLS. Track under `CURR-DATA-04` and existing Supabase migration-provenance work; no DB changes are authorized. |
| Production risk           | PASS for mapping only                  | No runtime, auth, data, trading, configuration or production behavior changed.                                                                                                                                                                     |

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
  BinanceChart[BinanceRealtimeChart<br/>public chart route]
  BinanceHistory[binance-kline-history.ts<br/>effect-owned AbortSignal]
  PublicBinance[Public Binance REST<br/>/api/v3/klines]
  Service[apps/service API]
  RuntimeEvents[Runtime Events Controller]
  RuntimeQuery[RuntimeEventsQueryService]
  Supabase[(Supabase persistence<br/>schema/RLS not audited here)]
  WSClient[microfe-ws.ts]
  WSService[runtime-events.websocket.ts<br/>auth handshake contract must be verified]

  Browser --> Layout --> Providers --> Routes
  Routes --> Redirect
  Routes --> Overview --> Shell
  Routes --> BinanceChart --> BinanceHistory --> PublicBinance
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

| Concern                      | Current source / symbol                                                                                                                                           | Verified behavior / boundary                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root App Router shell        | `apps/web/app/layout.tsx` — `RootLayout`                                                                                                                          | Imports global styles and wraps route children in `AppProviders`.                                                                                                                                                                                                                                                                                                              |
| Global browser providers     | `apps/web/app/providers.tsx` — `AppProviders`                                                                                                                     | Client Component; owns theme/toast and mounts WebSocket/system-update bridges.                                                                                                                                                                                                                                                                                                 |
| Dashboard entry              | `apps/web/app/dashboard/page.tsx` — `DashboardPage`                                                                                                               | Server-side route module redirects to `/overview`; it does not fetch dashboard data.                                                                                                                                                                                                                                                                                           |
| Overview page                | `apps/web/app/overview/page.tsx` — `OverviewPage`                                                                                                                 | Client Component composing `DashboardShell` and `OverviewView`. This is consistent with interactive Zustand/browser/realtime ownership; no SSR migration is justified by this lesson alone.                                                                                                                                                                                    |
| HTTP transport               | `apps/web/lib/api.ts` — `api`, `authClient`, `dashboardApi`, `platformApi`                                                                                        | Centralized Axios instances, credentials, request timeout, auth refresh/retry, CSRF handling and optional `AbortSignal` on selected reads.                                                                                                                                                                                                                                     |
| Public Binance chart history | `apps/web/components/dashboard/BinanceRealtimeChart.tsx`; `apps/web/lib/binance-kline-history.ts`; `binance-kline-history.spec.ts`                                | The effect owns an `AbortController`; cleanup aborts the public kline REST fetch, and disposed/aborted guards suppress late chart/state/error updates. The public WebSocket lifecycle and trading/execution paths remain unchanged.                                                                                                                                            |
| Dashboard state              | `apps/web/lib/store.ts` — `useDashboardStore`; `apps/web/lib/market-price-validation.ts` — `normalizeMarketPricePayload`                                          | Owns dashboard state including `marketPrices: Record<string, MarketPrice>`; market-price sync validates requested symbols and finite positive numeric prices before state updates.                                                                                                                                                                                             |
| TCE prefetch state           | `apps/web/lib/tce-data-store.ts` — `useTCEDataStore`                                                                                                              | Owns several prefetched API response collections; uses an `AbortController` and generation guard so cleared/superseded prefetches do not write stale results.                                                                                                                                                                                                                  |
| Telegram notification reads  | `apps/web/lib/telegram-notification-data.ts`; `apps/web/app/notifications/page.tsx`; `app/notifications/[id]/page.tsx`; `app/notifications/TelegramBotConfig.tsx` | PR #957 merged at `6b3beb546409358cf9cc1a8f000a4527f02255ab`. The typed loader forwards AbortSignal, effects abort on cleanup and guard data/loading commits by current route/account state. Exact PR head `052c301ad522d98802a13e88ed48c6a48c636de7` passed WF-01P #41024683065, WF-02 #41024683023 and WF-05 #41024682994 before merge. Post-merge checks remain unverified. |
| Engine Control reads         | `apps/web/app/engines/EngineControlPanel.tsx`; `apps/web/lib/engine-control-data.ts`; `engine-control-data.spec.ts`                                               | PR #961 merged at `53b70f9`. The effect-owned signal reaches both existing GETs and aborts on cleanup/restart; the active guard prevents stale commits. Three helper tests passed on exact head `ec240d8`; post-merge workflow status was not surfaced.                                                                                                                        |
| API error handling           | `apps/web/lib/api-errors.ts`, `api-errors.spec.ts`                                                                                                                | Shared API error normalization/cancellation classification. Verify call-site UX behavior before claiming every route has consistent error UI.                                                                                                                                                                                                                                  |
| Cancellation evidence        | `apps/web/lib/dashboard-cancellation.spec.ts`; `apps/web/lib/stock-event-store.spec.ts`                                                                           | Dashboard cancellation tests cover their request path; stock-event tests cover clear/late response, worker abort and safe errors. Tests alone do not prove every consumer is correctly wired.                                                                                                                                                                                  |
| Dividend-pool read lifecycle | `apps/web/lib/stock-dividend-pool-store.ts`; `apps/web/lib/app-data-worker.ts`; `stock-dividend-pool-store.spec.ts`; `app-data-worker.spec.ts`                    | Pool reads pass an optional `AbortSignal`, abort superseded requests, ignore obsolete generations and normalize safe errors. Worker clear aborts the pool read; API/auth/schema contracts are unchanged.                                                                                                                                                                       |
| Browser WebSocket client     | `apps/web/lib/microfe-ws.ts`, `microfe-ws.spec.ts`                                                                                                                | Owns reconnect/heartbeat/subscription/sequence-gap handling. Reconnect delay is bounded with jitter; retry counter resets only after a stable connection.                                                                                                                                                                                                                      |
| WebSocket lifecycle bridge   | `apps/web/app/providers.tsx` — `MicrofeWebSocketBridge`                                                                                                           | Starts the client only when auth store reports authenticated; stops it otherwise. This alone does not establish how the HTTP session is authenticated during the WS upgrade.                                                                                                                                                                                                   |
| SSE/runtime event HTTP API   | `apps/service/src/runtime-events/runtime-events.controller.ts`                                                                                                    | Derives account from Bearer JWT, validates cursor/event type/limit, exposes list and SSE routes.                                                                                                                                                                                                                                                                               |
| Durable event cursor         | `apps/service/src/runtime-events/runtime-events.query.service.ts`                                                                                                 | Queries `tce_runtime_events` with account scoping and timestamp/event-id cursor ordering; resolves `Last-Event-ID` only within the authenticated account.                                                                                                                                                                                                                      |
| WebSocket server             | `apps/service/src/runtime-events/runtime-events.websocket.ts`                                                                                                     | Actual server-side upgrade/auth contract must be reviewed before enabling a browser-to-service stream; see `CURR-AUTH-07` in the backlog.                                                                                                                                                                                                                                      |
| Performance consumers        | `apps/web/lib/store.ts`, `apps/web/lib/tce-data-store.ts`, real dashboard components under `apps/web/components/dashboard/`                                       | PERF-13-01 source mapping is complete in the Day 13 backlog and PR #952. This is a source map, not a profile; it identifies candidate broad subscriptions/row rebuilding but does not establish a dominant bottleneck. PERF-13-02/03 remain open.                                                                                                                              |
| Stock-event read lifecycle   | `apps/web/lib/stock-event-store.ts`; `apps/web/lib/app-data-worker.ts`; `apps/web/lib/stock-event-store.spec.ts`; `apps/web/lib/store.ts`                         | PR #955 adds internal abort/generation guards, forwards the worker signal and normalizes safe read errors; `clearAccountScopedStores()` clears this store on logout/account change. The authenticated endpoint contract is unchanged.                                                                                                                                          |

## 2. Mapping existing learning documents

| Lesson                                        | Actual entry points / source owners                                                                                                                                                                                                            | Relevant layers                                                                                                                                                                                                                                                                  | Readiness / unresolved work                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 9 — Next.js architecture                  | `app/layout.tsx`, `app/providers.tsx`, `app/dashboard/page.tsx`, `app/overview/page.tsx`, `components/dashboard/DashboardShell`, `components/dashboard/DashboardViews`, `lib/api.ts`                                                           | System design: PASS for current boundary map. Frontend: PASS. Service/API: centralized client identified. Infra: N/A for the mapping task; inspect before SSR/runtime change. DB: N/A unless data-access boundary changes. Integration: route/provider/auth relationship mapped. | No explicit requirement currently justifies migrating `/overview` to Server Components. Preserve browser-owned auth/state/realtime until a full server session contract is designed.                                                                                                           |
| Day 10 — REST errors/cancellation             | `lib/api.ts`, `api-errors.ts`, `lib/store.ts`, `market-price-validation.ts`, `tce-data-store.ts`, pool/event stores, `telegram-notification-data.ts`, `engine-control-data.ts`, `EngineControlPanel`, `BinanceRealtimeChart` and related specs | Frontend/service contract. Infra and DB: N/A for bounded client read-lifecycle fixes.                                                                                                                                                                                            | Quote validation, pool/event, Telegram, Engine Control and public Binance chart-history read cancellation are merged. PR #963 merge `086d537`; exact head passed WF-01P/WF-02/WF-05. Post-merge status remains unverified. Broader API-read caller audit remains open.                         |
| Day 11 — WebSocket/SSE/reconnect/backpressure | `lib/microfe-ws.ts`, `lib/microfe-ws.spec.ts`, `app/providers.tsx`, `apps/service/src/runtime-events/runtime-events.controller.ts`, `runtime-events.query.service.ts`, `runtime-events.websocket.ts`                                           | Frontend transport, backend service, auth boundary, persistence cursor and integration. Infra: not verified in this mapping. DB: durable table contract/RLS not verified here.                                                                                                   | Reconnect backoff and account-scoped SSE cursor are present on master. Browser WS authentication/upgrade remains blocked by `CURR-AUTH-07`; do not create/enable a quote stream until secure handshake is established. Queue/backpressure behavior must be inspected before claiming complete. |
| Day 12 — Normalization/cache                  | `lib/store.ts`, `lib/tce-data-store.ts`, `lib/account-cache-isolation.spec.ts`, API response contracts and runtime event cursor service                                                                                                        | Frontend state ownership, identity, invalidation, account isolation and snapshot/event consistency. DB: inspect only for a concrete version/cursor requirement.                                                                                                                  | PR #951 clears account-scoped stores before logout settles or after identity changes; regression tests are merged. Dashboard `marketPrices` remains symbol-keyed and no universal snapshot watermark is established, so ordering/reconciliation remains unresolved.                            |
| Day 13 — Performance profiling                | `lib/store.ts`, `lib/tce-data-store.ts`, actual dashboard components, `docs/learning/backlog/day13-performance-profiling-implementation-backlog.md`                                                                                            | Frontend rendering/state; browser profiling. Service/DB/infra are N/A until measurement points to those layers.                                                                                                                                                                  | PERF-13-01 source mapping is complete via PR #952; PERF-13-02 reproducible profiling baseline and PERF-13-03 measured acceptance criteria remain open. No speculative memoization/virtualization.                                                                                              |

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
2. **Day 10:** quote validation, pool/event lifecycle guards, Telegram notification reads, Engine Control reads and public Binance chart-history cancellation are merged. PR #963 exact-head WF-01P/WF-02/WF-05 passed; post-merge status remains unverified. Continue the broader API-read audit only for source-backed gaps.
3. **Day 11:** keep WebSocket transport integration blocked until `CURR-AUTH-07` is resolved. Continue only independent safe tasks, such as verifying current SSE cursor/replay and existing client gap behavior.
4. **Day 12:** account-scoped cache clearing is implemented and tested by PR #951; continue only with snapshot/event ordering, producer watermark/version and replay guarantees under `CURR-DATA-04`.
5. **Day 13:** `PERF-13-01` source mapping is complete via PR #952; capture `PERF-13-02` baseline and define `PERF-13-03` acceptance before choosing an optimization.

## Completion boundary

This document maintains the **source mapping/audit task** for the five existing lesson files against current master `086d537` after PR #963. Day 10 has bounded runtime slices merged for quote validation, pool/event reads, Telegram reads, Engine Control reads and public Binance chart-history cancellation; broader API-read coverage remains open. Day 11 browser WebSocket auth, Day 12 snapshot/event ordering, Day 13 profiling, live database state and production verification are not complete.

## Maintenance

Update this map whenever a source owner, route, API contract, event cursor, or readiness decision changes. Re-verify referenced paths against the current base branch.
