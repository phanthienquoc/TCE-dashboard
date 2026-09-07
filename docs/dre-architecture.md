# Dividend Rolling Engine (DRE) — architecture

## Purpose
DRE manages dividend-event campaigns and rolling position continuity. It is an orchestration/domain module, not a second trading-strategy engine.

## Dependency direction

```text
TCE Core ──(read-only decision port)──> DRE ──> Daily Agent ──> execution adapter
                                  │
                                  ├── campaign / rolling state
                                  ├── T+2 lifecycle policy
                                  └── continuity / GAP tracking
```

The important rule is that **TCE Core never imports DRE**. DRE consumes a `TceDecision` through `TceCorePort`; it cannot change entry, risk, take-profit, or quantity.

## Ownership

| Concern | Owner |
|---|---|
| Entry / signal | TCE Core |
| Risk | TCE Core |
| Take-profit | TCE Core |
| Quantity | TCE Core |
| Dividend event campaign | DRE |
| Sequence / current / next | DRE |
| T+2 lifecycle | DRE + settlement calendar port |
| Capital recycling state | DRE, using settled-cash read port |
| Daily observe/reconcile/action plan | Daily Agent (P6) |
| Broker order execution | Execution adapter (P7+) |

## P0 safety boundaries

- No live order execution is wired.
- No broker SDK is imported by DRE.
- No database implementation is coupled into the domain boundary.
- No circular dependency from `monitor/` (TCE Core) to `dre/`.
- Interfaces are explicit so later phases can add adapters without moving strategy ownership.

## Core state model

Campaigns are keyed by a distinct dividend event, so recurring annual/semi-annual events remain separate. Rolling positions use a monotonic `sequence` and explicit lifecycle states. A missed sequence is represented as `MISSED` / campaign `GAP`; it is never silently skipped.

T+2 is represented by `entryAt`, `settlementAt`, and `availableAt`. DRE must not authorize a sell before the position is available for settlement under the configured calendar policy.

## Idempotency contract (introduced fully in P7)

Actions use a deterministic idempotency key such as `SSI-20260914-03-SELL` or `SSI-20260914-04-BUY`. Re-running an orchestration cycle must reconcile an existing action rather than create a duplicate order.

## Future integration rule

When P1–P9 are implemented, keep this dependency direction. If an adapter needs TCE functionality, inject the `TceCorePort` interface into DRE from the application composition root; never add an import from TCE Core back into the DRE module.
