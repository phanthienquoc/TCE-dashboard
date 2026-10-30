# TCE Dashboard — Learning-to-Source Architecture Map

**Task:** `CURR-ARCH-01` — Map learning exercises to the real TCE architecture  
**Readiness:** `PARTIALLY READY` for source mapping; `NO-GO` for any new auth/SSR/DB/runtime contract changes inferred from this map  
**Audited source baseline:** `master` at `48083829805ed3d60162c77604e11b8b084bde89` (2026-10-30)  
**Purpose:** Trace the existing Day 9–13 learning notes to actual repository entry points and owners. This map records what source establishes and explicitly labels unresolved contracts; it does not claim every lesson's desired behavior is complete.

## System Readiness Check

| Area                      | Status                                               | Evidence                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                     | PASS                                                 | First backlog item `CURR-ARCH-01`; current `docs/learning/` contains Day 9–13 lesson files plus readiness/backlog documents.                                                                                                                               |
| Git/base                  | PASS                                                 | This refreshed map is based on current `master` `4808382`, after PR #949 added market-price payload validation. The original source-mapping PR #948 is already merged. |
| Existing PR overlap       | PASS                                                 | PR #949 is merged. The only open PR found, #928, edits `plan/agentic-task-queue.md` only and does not overlap this learning source map. The browser quote-stream proposal in PR #936 remains closed unmerged. |
| Source ownership          | PASS for mapped frontend/runtime paths               | Verified App Router layout/pages/providers, API client, stores, WebSocket client and runtime-events controller/query service.                                                                                                                              |
| Build/test baseline       | PASS for current master CI | PR #949 exact-head frontend build, Prettier and unit checks passed; master Prettier, backend unit tests, and WF-01 Build + Verify passed on `4808382`. This documentation PR still requires its own checks. |
| Infrastructure/deployment | N/A for this documentation-only task                 | No manifests, workflow, service configuration or deployment was changed. Re-check them before SSR/runtime/deployment changes.                                                                                                                              |
| Secrets/permissions       | N/A for this documentation-only task                 | No credentials accessed or changed. Required presence/access must be verified before tasks that need them; never print values.                                                                                                                             |
| Database/migrations       | WARN / unresolved                                    | Runtime-events query code reads `tce_runtime_events` through Supabase. This mapping did not verify live schema, migration ledger or RLS. Track under `CURR-DATA-04` and existing Supabase migration-provenance work; no DB changes are authorized.         |
| Production risk           | PASS for mapping only                                | No runtime, auth, data, trading, configuration or production behavior changed.                                                                                                                                                                             |

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
  WSClient -. "separate upgrade/auth contract" .-> WSService
  Service --> RuntimeEvents --> RuntimeQuery --> Supabase
  WSService --> RuntimeQuery
```

### Verified source ownership

| Concern                    | Current source / symbol                                                                                                     | Verified behavior / boundary                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root App Router shell      | `apps/web/app/layout.tsx` — `RootLayout`                                                                                    | Imports global styles and wraps route children in `AppProviders`.                                                                                                                           |
| Global browser providers   | `apps/web/app/providers.tsx` — `AppProviders`                                                                               | Client Component; owns theme/toast and mounts WebSocket/system-update bridges.                                                                                                              |
| Dashboard entry            | `apps/web/app/dashboard/page.tsx` — `DashboardPage`                                                                         | Server-side route module redirects to `/overview`; it does not fetch dashboard data.                                                                                                        |
| Overview page              | `apps/web/app/overview/page.tsx` — `OverviewPage`                                                                           | Client Component composing `DashboardShell` and `OverviewView`. This is consistent with interactive Zustand/browser/realtime ownership; no SSR migration is justified by this lesson alone. |
| HTTP transport             | `apps/web/lib/api.ts` — `api`, `authClient`, `dashboardApi`, `platformApi`                                                  | Centralized Axios instances, credentials, request timeout, auth refresh/retry, CSRF handling and optional `AbortSignal` on selected reads.                                                  |
| Dashboard state            | `apps/web/lib/store.ts` — `useDashboardStore`; `apps/web/lib/market-price-validation.ts` — `normalizeMarketPricePayload` | Owns dashboard state including `marketPrices: Record<string, MarketPrice>`; market-price sync validates requested symbols and finite positive numeric prices before state updates. |
| TCE prefetch state         | `apps/web/lib/tce-data-store.ts` — `useTCEDataStore`                                                                        | Owns several prefetched API response collections; uses an `AbortController` and generation guard so cleared/superseded prefetches do not write stale results.                               |
| API error handling         | `apps/web/lib/api-errors.ts`, `api-errors.spec.ts`                                                                          | Shared API error normalization/cancellation classification. Verify call-site UX behavior before claiming every route has consistent error UI.                                               |
| Cancellation evidence      | `apps/web/lib/dashboard-cancellation.spec.ts`                                                                               | Tests request signal forwarding and stale dashboard load behavior; tests alone do not prove every consumer is correctly wired.                                                              |
| Browser WebSocket client   | `apps/web/lib/microfe-ws.ts`, `microfe-ws.spec.ts`                                                                          | Owns reconnect/heartbeat/subscription/sequence-gap handling. Reconnect delay is bounded with jitter; retry counter resets only after a stable connection.                                   |
| WebSocket lifecycle bridge | `apps/web/app/providers.tsx` — `MicrofeWebSocketBridge`                                                                     | Starts the client only when auth store reports authenticated; stops it otherwise. This alone does not establish how the HTTP session is authenticated during the WS upgrade.                |
| SSE/runtime event HTTP API | `apps/service/src/runtime-events/runtime-events.controller.ts`                                                              | Derives account from Bearer JWT, validates cursor/event type/limit, exposes list and SSE routes.                                                                                            |
| Durable event cursor       | `apps/service/src/runtime-events/runtime-events.query.service.ts`                                                           | Queries `tce_runtime_events` with account scoping and timestamp/event-id cursor ordering; resolves `Last-Event-ID` only within the authenticated account.                                   |
| WebSocket server           | `apps/service/src/runtime-events/runtime-events.websocket.ts`                                                               | Actual server-side upgrade/auth contract must be reviewed before enabling a browser-to-service stream; see `CURR-AUTH-07` in the backlog.                                                   |
| Performance consumers      | `apps/web/lib/store.ts`, `apps/web/lib/tce-data-store.ts`, real dashboard components under `apps/web/components/dashboard/` | The Day 13 backlog `PERF-13-01` remains the required call-site trace. Do not infer that broad subscriptions are the bottleneck without inspecting component selectors and profiling.        |

## 2. Mapping existing learning documents

| Lesson                                        | Actual entry points / source owners                                                                                                                                                                  | Relevant layers                                                                                                                                                                                                                                                                  | Readiness / unresolved work                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day 9 — Next.js architecture                  | `app/layout.tsx`, `app/providers.tsx`, `app/dashboard/page.tsx`, `app/overview/page.tsx`, `components/dashboard/DashboardShell`, `components/dashboard/DashboardViews`, `lib/api.ts`                 | System design: PASS for current boundary map. Frontend: PASS. Service/API: centralized client identified. Infra: N/A for the mapping task; inspect before SSR/runtime change. DB: N/A unless data-access boundary changes. Integration: route/provider/auth relationship mapped. | No explicit requirement currently justifies migrating `/overview` to Server Components. Preserve browser-owned auth/state/realtime until a full server session contract is designed.                                                                                                           |
| Day 10 — REST errors/cancellation             | `lib/api.ts`, `lib/api-errors.ts`, `lib/store.ts`, `lib/market-price-validation.ts`, `lib/tce-data-store.ts`, `lib/dashboard-cancellation.spec.ts`, `lib/market-price-validation.spec.ts` | Frontend/service contract. Infra and DB: N/A for the current read-only quote-validation change. | Safe error normalization, cancellation guards, and market-price payload validation are present on master. PRs #938/#939 were test-only; runtime behavior is provided by #929/#949. Broader read-caller audit remains open. |
| Day 11 — WebSocket/SSE/reconnect/backpressure | `lib/microfe-ws.ts`, `lib/microfe-ws.spec.ts`, `app/providers.tsx`, `apps/service/src/runtime-events/runtime-events.controller.ts`, `runtime-events.query.service.ts`, `runtime-events.websocket.ts` | Frontend transport, backend service, auth boundary, persistence cursor and integration. Infra: not verified in this mapping. DB: durable table contract/RLS not verified here.                                                                                                   | Reconnect backoff and account-scoped SSE cursor are present on master. Browser WS authentication/upgrade remains blocked by `CURR-AUTH-07`; do not create/enable a quote stream until secure handshake is established. Queue/backpressure behavior must be inspected before claiming complete. |
| Day 12 — Normalization/cache                  | `lib/store.ts`, `lib/tce-data-store.ts`, API response contracts, runtime event cursor service                                                                                                        | Frontend state ownership, identity, invalidation, account isolation and snapshot/event consistency. DB: inspect only for a concrete version/cursor requirement.                                                                                                                  | Current dashboard uses `marketPrices` keyed by symbol while `tce-data-store` stores several broad response objects. Do not copy the illustrative `quotesBySymbol` shape or invent a global watermark. Verify account-switch/logout cleanup and ordering contracts in the next task.            |
| Day 13 — Performance profiling                | `lib/store.ts`, `lib/tce-data-store.ts`, actual dashboard components, `docs/learning/backlog/day13-performance-profiling-implementation-backlog.md`                                                  | Frontend rendering/state; browser profiling. Service/DB/infra are N/A until measurement points to those layers.                                                                                                                                                                  | `PERF-13-01` through `PERF-13-03` are prerequisites. No speculative memoization/virtualization and no fabricated baseline.                                                                                                                                                                     |

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
4. **Day 13 has no verified performance baseline.** The current backlog explicitly requires component/selector mapping and a reproducible profile before a runtime optimization.

## 5. Task ordering after CURR-ARCH-01

1. **Day 9:** architecture mapping is now source-backed. No runtime change is warranted solely to force a Server Component conversion.
2. **Day 10:** quote payload validation is merged and CI-verified. Continue only if source audit finds a concrete remaining API read/error/loading gap; preserve centralized auth, stale-response protection and user-visible state.
3. **Day 11:** keep WebSocket transport integration blocked until `CURR-AUTH-07` is resolved. Continue only independent safe tasks, such as verifying current SSE cursor/replay and existing client gap behavior.
4. **Day 12:** verify account isolation, clear-on-logout, identity and snapshot/event ordering from current code and contracts before altering cache shapes.
5. **Day 13:** complete `PERF-13-01` call-site map, then `PERF-13-02` baseline and `PERF-13-03` acceptance before choosing an optimization.

## Completion boundary

This document completes the **source mapping/audit task** for the five lesson files present in `docs/learning/`. It does not mean Day 10–13 runtime work is complete, the database has been audited, WebSocket auth is fixed, or production has been verified.

## Maintenance

Update this map whenever a source owner, route, API contract, event cursor, or readiness decision changes. Re-verify referenced paths against the current base branch.
