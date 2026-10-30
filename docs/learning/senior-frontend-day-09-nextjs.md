# Senior Frontend Day 9 — Next.js Architecture Notes for TCE

> Scope: learning notes aligned to the existing TCE Dashboard implementation. This document does not introduce a new market route or alter runtime behavior.

## Implementation readiness — cross-layer assessment

Before treating this lesson as complete, apply the shared [Learning Implementation Readiness Gate](IMPLEMENTATION_READINESS.md). A code snippet, test-only change, or documentation update is not proof that the product behavior exists end to end. See the source-backed [TCE Dashboard learning-to-source architecture map](architecture-map.md) for verified App Router entry points, ownership boundaries, and unresolved cross-layer contracts.

### TCE-specific inspection scope

- **System design:** verify the actual App Router entry point, Server/Client Component boundary, providers, route ownership, and where data fetching belongs.
- **Service/API:** trace the centralized API/auth client and the real backend contract before moving data access across a server/client boundary.
- **Infrastructure:** if changing SSR, runtime environment, or server-only code, inspect build/deployment runtime compatibility and secret exposure; do not assume browser environment variables exist server-side or vice versa.
- **Integration:** verify navigation, auth/session behavior, loading/error states, and the actual deployed route where relevant.
- **Database:** assess only if the proposed data-access change reaches persistence; do not add schema changes for a routing/rendering exercise.

Record a **READY / PARTIALLY READY / BLOCKED** decision. Implement real runtime behavior only where ownership and contracts are established; otherwise link a concrete item in [the cross-layer curriculum backlog](backlog/curriculum-implementation-backlog.md). Assess system design, infrastructure, service/backend, database, frontend and integration impacts; mark irrelevant layers N/A with a reason. Do not claim deployment or production verification without evidence.

## Current repository findings

- Frontend is Next.js 16 + React 19 under `apps/web`, inside an Nx monorepo.
- App Router files are under `apps/web/app`.
- `apps/web/app/layout.tsx` wraps the app in `AppProviders`; the global providers are a Client Component because they own browser-side state, toast, service-worker, auth and WebSocket bridges.
- `apps/web/app/dashboard/page.tsx` redirects to `/overview`.
- `apps/web/app/overview/page.tsx` is a Client Component using `DashboardShell` and `OverviewView`.
- FE API calls are expected to use the centralized Axios/API service; authentication attaches the access token and handles refresh behavior.
- Existing navigation is mobile-first and switches dashboard tabs without full page navigation.
- `lightweight-charts` is already an app dependency; chart/browser-specific work belongs behind a client-side boundary.
- The repository's runtime contract documentation says REST, WebSocket and SSE should share the same semantic versioned event envelope. Treating each transport as a separate domain contract is discouraged.

## Server Components vs Client Components

Use Server Components for suitable server-side composition and data access. Use Client Components where browser APIs, event handlers, React client hooks, Zustand subscriptions, interactive charts, or WebSocket lifecycles are required.

Do not add `"use client"` to an entire route merely because one child needs interaction. Keep the client boundary as small as is practical.

For the current TCE overview, the existing client page and centralized auth/API design are part of the live architecture. A Server Component migration is not automatically beneficial: browser-managed authentication and authenticated Axios requests need an explicit design before moving data fetching to the server.

## Rendering and cache policy

Rendering choice and data-cache policy are separate concerns. Do not assume dynamic rendering alone guarantees that every underlying source is fresh.

For account balances, positions, engine status and execution-related data:

- define an explicit freshness policy;
- preserve account/environment scope;
- validate data at runtime boundaries;
- distinguish stale/unavailable data from current confirmed state;
- never represent a submitted request as a completed trade without authoritative confirmation.

For static public material that changes infrequently, static rendering and caching may be appropriate.

## Route and UI boundaries

Use App Router conventions already present in `apps/web/app`. A new route should reuse the current shell, navigation, styles and shared API layer instead of introducing a parallel application shell.

A useful conceptual split is:

- Route/page: composition, parameters, page-level error/loading boundaries.
- Feature component: market watch, positions, chart or engine UI.
- API/service layer: authenticated transport, response/error normalization.
- Domain contracts: shared typed data shape and validation.
- Realtime layer: subscription lifecycle, event ordering, reconnect and freshness.

Do not place API credentials, access tokens, OTPs, private keys or other secrets in client bundles or documentation.

## TCE-specific realtime flow

1. Load an initial snapshot through the existing backend/service contract where appropriate.
2. Subscribe to the established realtime transport for updates.
3. Validate and scope every event before applying it.
4. Use sequence/version metadata where provided to reject older events.
5. On reconnect, resynchronize from an authoritative snapshot or replay cursor as required by the contract.
6. Keep UI rendering optimizations separate from correctness requirements; do not drop events required for trading decisions, audit or reconciliation.

## Senior-level trade-offs

| Decision                                         | Benefit                                                             | Trade-off / risk                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Server Component for initial data                | Keeps suitable logic/data access on server and can reduce client JS | Must design auth/session propagation and freshness correctly                  |
| Client Component for chart and live interactions | Supports browser APIs, user interaction and WebSocket lifecycle     | Adds client JavaScript and requires cleanup/error handling                    |
| Shared layout/shell                              | Preserves navigation and common UI across routes                    | Too much state in the shell can cause broad coupling                          |
| Explicit cache policy                            | Makes freshness and reuse intentional                               | `no-store` reduces cache reuse and does not guarantee backend data is current |
| Server snapshot + WebSocket                      | Fast initial view plus live updates                                 | Requires ordering, reconnect and snapshot reconciliation                      |

## Verification checklist for changes

- Follow repository mandatory workflow: branch from latest `master`, implement on the dedicated branch, review diff, squash task history to one clean commit, open a PR, squash-merge, and verify master/CI/deployment.
- Reuse the existing API/auth layer rather than bypassing centralized JWT refresh/session handling.
- Update `docs/fe-feats` for user-visible frontend behavior changes.
- Run the relevant typecheck, tests and build where available; state clearly if a check could not be run.
- Avoid unrelated schema migrations, credential changes, live execution enablement or changes to trading strategy.
