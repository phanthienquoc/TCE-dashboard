# TCE Hunting Dividend Core Engine

## Scope

This document is the source-of-truth for the provider-neutral Hunting Dividend Decision Engine. It defines the core decision contract before execution, UI, scheduler, or broker adapters.

## Core invariants

1. The Decision Engine is **decision-only**. It never submits broker orders.
2. `stock_events` / normalized dividend events are the source for entitlement dates; market/position data are inputs, not side effects.
3. A position must protect dividend entitlement before a profit exit is considered.
4. Profit is evaluated net of transaction effects where available; dividend is evaluated net of tax/fees where available.
5. `profit_net > dividend_net` is an exit trigger **only when dividend entitlement is already protected**.
6. Otherwise the position remains `HOLD` (or `WAIT` when required data is unavailable).
7. No hard-coded loss cut is introduced for Vietnam cash-equity dividend hunting. An invalidation field may exist as a planning/risk input, but it is not an automatic `CUT` rule in this core engine.
8. Duplicate decisions are prevented by a deterministic decision key.
9. Configuration comes from `tce_engine_configs.config`; code defaults are fallback values only.
10. Decision output is provider-neutral and persisted as an immutable snapshot.

## Inputs

```ts
type HuntingDividendContext = {
  timestamp: string;
  candidates: DividendCandidate[];
  positions: DividendPosition[];
  pools: CapitalPoolState[];
  capital: CapitalState;
  config?: Record<string, unknown>;
};

type DividendCandidate = {
  symbol: string;
  price: number;
  dividendValue?: number;
  dividendNet?: number;
  dividendRatio?: string | number;
  exRightDate?: string;
  recordDate?: string;
  paymentDate?: string;
  gdkhqTimestamp?: string;
  realPnl?: number;
  realPnlNet?: number;
  id?: string;
};

type DividendPosition = {
  symbol: string;
  pool: "A" | "B" | "C";
  slot: string;
  quantity: number;
  entryPrice?: number;
  currentPrice?: number;
  targetPrice?: number;
  dividendGross?: number;
  dividendNet?: number;
  exRightDate?: string;
  recordDate?: string;
  paymentDate?: string;
  entitlementStatus?:
    | "UNKNOWN"
    | "NOT_ELIGIBLE"
    | "AT_RISK"
    | "PROTECTED"
    | "CONFIRMED";
  sellableAt?: string;
  status?: string;
};
```

## Decision actions

```text
BUY | HOLD | SELL | WAIT | SKIP
```

`BUY` applies to a free slot and an approved dividend candidate. `HOLD` keeps an existing position. `SELL` is emitted only when the exit gate is satisfied. `WAIT` means the engine lacks sufficient current data to make a safe transition. `SKIP` means a candidate/position is intentionally excluded by deterministic rules.

## Pseudo

```pseudo
function decide(context): decisions

  cfg = loadConfig(context.config, DEFAULTS)
  now = context.timestamp

  decisions = []

  # --------------------------------------------------
  # 1. Existing positions: lifecycle first
  # --------------------------------------------------
  for position in context.positions:

    event = resolveDividendEvent(position.symbol, position)
    entitlement = resolveEntitlement(position, event, now)

    if entitlement == UNKNOWN:
      decisions.push(WAIT(position, "dividend_entitlement_unknown"))
      continue

    # Protect dividend first.
    if entitlement in [AT_RISK, NOT_ELIGIBLE]:
      decisions.push(HOLD(position, "protect_dividend_entitlement"))
      continue

    profitNet = calculateProfitNet(position, context)
    dividendNet = calculateDividendNet(position, event)

    # Primary exit rule for the dividend strategy.
    if entitlement in [PROTECTED, CONFIRMED]
       and profitNet is known
       and dividendNet is known
       and profitNet > dividendNet:

      decisions.push(SELL(
        position,
        reasons = [
          "dividend_entitlement_protected",
          "profit_net_exceeds_dividend_net"
        ]
      ))
      continue

    # Optional target is a secondary exit signal, never an entitlement bypass.
    if entitlement in [PROTECTED, CONFIRMED]
       and targetReached(position, cfg):
      decisions.push(SELL(position, "target_reached_after_dividend_protection"))
      continue

    decisions.push(HOLD(position, "continue_dividend_lifecycle"))

  # --------------------------------------------------
  # 2. New candidates: rank -> validate -> allocate
  # --------------------------------------------------
  occupiedSymbols = symbols(context.positions)
  occupiedSlots = slots(context.positions)

  candidates = normalizeAndRank(context.candidates, cfg)

  for pool in [A, B, C]:
    if poolHasNoCapacity(pool, context, cfg):
      continue

    for slot in availableSlots(pool, context, cfg):
      candidate = nextCandidate(candidates, occupiedSymbols, slot)
      if candidate is null:
        continue

      if !dividendWindowValid(candidate, now, cfg):
        continue
      if !candidateDataSufficient(candidate):
        decisions.push(SKIP(candidate, "insufficient_candidate_data"))
        continue
      if !confidenceAboveThreshold(candidate, cfg):
        decisions.push(SKIP(candidate, "confidence_below_threshold"))
        continue

      entry = candidate.price
      target = calculateTarget(entry, cfg.tpPercent)
      allocation = calculateSlotAllocation(pool, slot, context, cfg)

      decisions.push(BUY(
        symbol = candidate.symbol,
        pool = pool,
        slot = slot,
        capital = allocation,
        entry = entry,
        target = target,
        candidateId = candidate.id,
        strategyVersion = cfg.strategyVersion,
        reasons = [
          "dividend_event_in_window",
          "candidate_ranked",
          "confidence_above_threshold",
          "slot_available",
          "capital_available"
        ]
      ))

      reserveCandidate(candidate, slot)

  return deduplicate(decisions)
```

## Profit / dividend accounting

```text
profit_gross = (current_price - entry_price) * sellable_quantity
profit_net   = profit_gross - estimated_exit_costs - applicable_taxes

dividend_gross = declared_cash_dividend * eligible_quantity
dividend_net   = dividend_gross - dividend_tax - applicable_dividend_costs
```

If exact net inputs are unavailable, the engine must not manufacture precision. It may use a configured deterministic estimate and record that the value is estimated. If the comparison cannot be made safely, return `WAIT/HOLD`, not `SELL`.

## Entitlement gate

```text
                    ┌─ entitlement at risk/not eligible ─→ HOLD
Position ─→ event ──┤
                    ├─ entitlement unknown ─────────────→ WAIT
                    │
                    └─ protected/confirmed
                              │
                              ▼
                       compare profit_net
                       vs dividend_net
                         │            │
                  profit > div    profit <= div
                         │            │
                        SELL         HOLD
```

`PROTECTED` means the position satisfies the strategy's eligibility condition for the relevant corporate action. `CONFIRMED` means the dividend/cash event has subsequently been reconciled.

## BUY flow

```text
Market + Dividend Events
        ↓
Normalize
        ↓
30-day dividend window
        ↓
Candidate score / confidence
        ↓
Exclude occupied symbols
        ↓
Pool A/B/C capacity
        ↓
Free slot
        ↓
Capital allocation
        ↓
BUY decision
        ↓
Decision snapshot
        ↓
Execution layer (separate)
```

## Existing-position flow

```text
Position
   ↓
Resolve dividend event
   ↓
Resolve entitlement
   ├── UNKNOWN ───────────────→ WAIT
   ├── AT_RISK / NOT_ELIGIBLE → HOLD
   └── PROTECTED / CONFIRMED
             ↓
       calculate profit_net
       calculate dividend_net
             ↓
      profit_net > dividend_net?
        ├── YES → SELL
        └── NO  → HOLD
```

## Sequence

```text
Scheduler
  │
  ▼
Market/Dividend Data ──→ Candidate Normalizer
                              │
                              ▼
                     Hunting Dividend Engine
                       │                │
                       │ existing      │ new candidates
                       ▼                ▼
                Entitlement Gate    Rank + Capacity
                       │                │
                       ▼                ▼
                Profit vs Dividend   BUY decision
                       │                │
                 SELL/HOLD/WAIT       │
                       └──────┬────────┘
                              ▼
                       Decision Snapshot
                              │
                              ▼
                    Execution Engine boundary
                              │
                              ▼
                       Position Reconcile
                              │
                              └──────────→ next scan
```

## Persistence notes

- `tce_engine_configs`: runtime configuration, keyed by `account_id + engine_id`.
- `stock_events`: dividend/corporate-action source (`ex_right_date`, `record_date`, `payment_date`, `dividend_value`).
- `tce_positions`: authoritative local position state and current P&L.
- `tce_position_snapshots`: monitoring observations/signals.
- `tce_cashout_events`: dividend/exit/cashout lifecycle evidence.
- `tce_dividend_decision_snapshots`: immutable Decision Engine output for audit/idempotency.
- `tce_buy_candidates`: execution queue only; a Pool entry is not an order.

## Idempotency

```text
decisionId = strategyVersion
           + ":" + symbol
           + ":" + action
           + ":" + slot
           + ":" + lifecycleWindow
```

The same input state must produce the same decision ID and equivalent decision payload. Persist before handing off to execution when the application transaction boundary allows it.

## Configuration defaults

Defaults are safe fallbacks only and must be overridden by DB configuration when present.

```text
lookbackDays = 30
TP = +5%
minConfidence = 0.50
slotsPerPool = 1
maxHoldDays = 30
```

There is **no hard-coded `pnlPct <= invalidation => CUT` rule** in this core strategy.

## Out of scope for the Decision Engine

- SSI/Broker API calls
- order submission/cancel/replace
- authentication/token refresh
- UI state
- scheduler implementation
- automatic lot escalation
- revenge trading
- broker-specific DTOs
