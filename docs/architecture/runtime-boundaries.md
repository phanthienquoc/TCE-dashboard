# TCE Runtime Boundaries & Contract Standardization

## Purpose

Standardize ownership and contracts across `apps/service`, `libs/tce-engine`, `libs/platform`, and `apps/service/src/monitor` without creating a second strategy or execution framework. Migrate incrementally and preserve existing runtime behavior.

## Evidence from the current repository

- `libs/contracts` already exports provider-facing platform ports, normalized market/account types, execution commands/results, risk-gate types, trading authorization, and order reconciliation.
- `libs/tce/src/execution/execution-orchestrator.ts` is the provider-neutral command dispatch boundary. It supports the durable store port; the production Profit Exit path now injects Supabase storage behind `TCE_DURABLE_EXECUTION_IDEMPOTENCY_ENABLED=true`. The flag remains off until the additive migration is applied and staging is verified.
- `libs/tce/src/execution/trading-authorization.ts` checks non-PAPER execution authorization through a provider-neutral port.
- `docs/dre-architecture.md` assigns entry/risk/TP/quantity to TCE Core; dividend campaign, sequence, T+2, continuity and GAP to DRE; execution to an execution adapter. TCE Core must not import DRE.
- `apps/service/src/monitor/tce-monitor.service.ts` schedules position snapshots and PnL-derived signals, writes cashout/audit records, and records that the candidate feed is not configured. Migration must preserve behavior and must not silently promote Monitor signals to broker commands.

## Target responsibility matrix

| Component              | Owns                                                                                           | Does not own                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/service`         | NestJS composition root, transport adapters, auth boundary and dependency wiring               | Strategy rules, direct broker command submission                  |
| `libs/contracts`       | Provider-neutral DTOs, ports, result/error contracts and event envelopes                       | Runtime adapters or side effects                                  |
| `libs/tce-engine`      | Deterministic strategy evaluation                                                              | Database, scheduler, network, provider SDK or live execution      |
| `libs/platform`        | Provider adapters for market, account and execution capabilities                               | Strategy ownership or DRE campaign state                          |
| Monitor                | Scheduled observation, health/freshness, snapshots and alert/event emission                    | Campaign authority or order dispatch                              |
| DRE                    | Dividend campaign state, sequence/rolling continuity, settlement/T+2 policy, GAP tracking and lifecycle event emission | Changing TCE decision/risk/TP/quantity or calling broker directly |
| Execution Orchestrator | Command validation, scoped authorization, idempotency, provider dispatch and normalized result | Strategy evaluation or campaign lifecycle                         |
| Reconciliation         | Compare local intents/orders/positions with provider truth and classify drift                  | Blind resubmission of unknown outcomes                            |

## Shared event contract

Canonical version 1 envelope:

```ts
export type TceEventEnvelope<TType extends string, TData> = Readonly<{
  eventId: string;
  eventType: TType;
  schemaVersion: 1;
  occurredAt: string;
  producer: string;
  correlationId: string;
  accountId?: string;
  aggregateId?: string;
  sequence?: number;
  data: TData;
}>;
```

Rules:

- `eventId` is unique and stable across retries; `correlationId` follows the request/campaign/execution lifecycle.
- `accountId` and environment scoping must remain explicit for account-sensitive events. Do not infer tenant/account from payloads supplied by clients.
- `occurredAt` is ISO-8601 UTC. Reject malformed timestamps at runtime boundaries.
- `schemaVersion` is a positive explicit contract version. Changes that break readers require a new version and a compatibility window.
- Event payloads reuse existing contract types: platform market/account shapes and TCE decision/risk/execution/reconciliation types. Do not redefine those shapes in each transport adapter.
- DRE campaign and position lifecycle transitions emit `dre.campaign.updated` with stable transition IDs, aggregate/sequence context and correlation ID. Publisher failures are best-effort; Mongo remains authoritative until a durable cross-database outbox/replay exists.
- REST replay, SSE and read-only WebSocket use the same persisted envelope. Account scope is derived from verified bearer identity or auth-service session introspection; transport control errors are distinct from domain events.
- REST response DTOs, WebSocket frames and SSE `data` messages share semantic envelope and error classification; transport framing may differ, domain semantics must not.

## Error and execution rules

- Reuse `ContractResult<T>` at provider boundaries. Normalize errors into stable codes and mark retryability separately from reconciliation requirement.
- Missing, expired, unavailable or scope-mismatched trading authorization denies non-PAPER commands.
- Engine enabled/disabled is not trading permission. Risk approval and execution authorization remain separate gates.
- A deterministic idempotency key is reserved at the execution boundary before dispatch and bound to account, environment, fingerprint and intent. The production Profit Exit path uses this only when the rollout flag is enabled.
- If a provider call times out or throws after dispatch may have happened, return an UNKNOWN/reconciliation-required result. Do not blindly resubmit.
- Duplicate keys with different command fingerprints are rejected. The same key and same fingerprint returns the previously recorded outcome or a pending/reconciliation result.
- Durable storage is required to claim idempotency across restarts/replicas; the in-memory map is a local fallback only. Do not enable the durable-store flag until migration `202610210001_tce_execution_idempotency.sql` is applied and verified.
- Preserve partial-fill and provider-rejected states. Never map an uncertain outcome to success.
- Domain code uses normalized typed fields only. Provider `raw` fields are diagnostics and must not influence strategy decisions.

## Dependency rules

1. Runtime dependencies point inward: transport/composition -> domain ports/contracts -> pure domain.
2. Provider SDKs and persistence adapters stay outside `libs/contracts` and pure `libs/tce-engine`.
3. TCE Core does not import DRE. DRE receives TCE capability through `TceCorePort` injection from the composition root.
4. Monitor cannot import provider order-submit SDKs or invoke execution adapters.
5. Only Execution Orchestrator may dispatch authorized `SUBMIT/CANCEL/REPLACE` commands to execution ports.
6. Strategy decisions must pass risk/safety and trading authorization before non-PAPER dispatch.
7. REST, WebSocket and SSE are transport adapters for the same event contract, not independent domain models.

## Implementation phases

### Phase 0 — Inventory and safety baseline

- [x] Inspect existing platform, execution, risk, auth and reconciliation contracts plus DRE ownership.
- [x] Commit this architecture record and add automated dependency-boundary tests.

### Phase 1 — Canonical event envelope

- [x] Add the generic versioned envelope and event metadata contract under `libs/contracts`.
- [x] Export it from the existing contract barrel without redefining existing DTOs.
- [x] Add tests for required IDs, schema version, timestamps, account/correlation propagation and malformed input.
- [x] Validate the shared envelope and known event names at runtime; event-specific payload schemas remain a follow-up.

### Phase 2 — Runtime ownership boundaries

- [x] Monitor remains observe/snapshot/alert only; its events do not dispatch orders.
- [x] DRE campaign status, rolling-position sequence/state, T+2 and capital recycling emit canonical lifecycle events without broker authority.
- [x] Document DRE ownership of campaign/sequence/T+2/continuity/GAP lifecycle and TCE Core strategy ownership.
- [x] Execution Orchestrator remains the command dispatch boundary for the Profit Exit slice.
- [x] Add import-boundary tests preventing TCE Core↔DRE cycles and broker SDK imports in core/DRE/monitor.

### Phase 3 — REST, WebSocket and SSE

- [x] Map REST success/error DTOs to canonical contracts.
- [x] Publish the same versioned envelope over REST replay, WebSocket and SSE.
- [x] Add query/controller/contract tests for account scope, replay cursors, event envelopes and stable error codes.

### Phase 4 — Execution reliability

- [x] Define a durable idempotency store port and Supabase adapter, with account/environment/fingerprint scoping.
- [x] Inject the durable store into the production Profit Exit execution path behind an explicit rollout flag.
- [x] Keep reservation failure pre-dispatch and retryable; make result-persistence failure UNKNOWN/reconciliation-required.
- [x] Existing PENDING/UNKNOWN reservations cannot redispatch and require reconciliation.
- [ ] Complete remaining failure matrix for rate limits, partial fills and provider-truth reconciliation.
- [ ] Enable the durable-store flag only after the migration is applied and staging is verified.
- [x] No live execution is enabled by this refactor.

### Phase 5 — Incremental migration

- [ ] Migrate one vertical slice at a time behind compatibility adapters.
- [ ] Preserve current endpoint and DB compatibility unless explicitly migrated in a separate change.
- [ ] Run contract tests, unit tests, typecheck, build, lint and diff review.
- [ ] Open a squash-merge PR and verify checks/deployment status.

## Acceptance criteria

- One canonical contract barrel for shared event metadata and normalized domain/provider boundaries.
- No direct strategy-to-provider calls; every non-PAPER command crosses risk and authorization gates.
- REST/WS/SSE carry semantically equivalent typed/versioned payloads and correlation IDs.
- Durable idempotency prevents duplicate submission across restart/replicas when the rollout flag is enabled after migration.
- Unknown result requires reconciliation; automatic retry is forbidden until classified safe.
- Wrong account/environment, missing/expired authorization, risk rejection and stale required data deny non-PAPER execution.
- Dependency rules are protected by automated tests.
- Existing monitor behavior and DRE/TCE responsibility boundaries remain backward compatible during migration.

## Explicit non-goals

- No strategy tuning or changing BUY/SELL thresholds.
- No enabling LIVE mode or placing real orders.
- No credential changes, production DB migration, or destructive schema changes in the initial contract slice.
- No wholesale file moves before dependency evidence and migration tests exist.
