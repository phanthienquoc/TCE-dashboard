# TCE Hunting Dividend — Full-Flow Implementation Plan

> **Status:** Planned  
> **Scope:** Turn the current Hunting Dividend Decision Engine prototype into a production-capable end-to-end trading lifecycle while preserving TCE's contract-first architecture.

## 1. Goal

Build a complete Hunting Dividend trading engine that can move from market/dividend discovery to candidate selection, decision, capital/slot allocation, order planning, SSI execution, reconciliation, dividend/T+2 lifecycle, take-profit exit, and slot recycling.

The target flow is:

```text
Stock / Market Data + Dividend Events
        ↓
Candidate Scanner / Normalizer
        ↓
Decision Engine — Hunting Dividend
        ↓
Capital Allocator + Slot Manager
        ↓
Order Planner
        ↓
Risk / Safety Gate
        ↓
Execution Engine
        ↓
SSI Adapter
        ↓
Order Reconciliation
        ↓
Position Reconciliation
        ↓
Ex-Dividend / T+2 Lifecycle
        ↓
Dividend Confirmation
        ↓
Exit / Take Profit +5%
        ↓
Close Position
        ↓
Recycle Slot / Capital
        ↓
Scan Again
```

## 2. Architectural Rules

- Keep the system **contract-first**.
- Domain and UI code must not directly depend on SSI SDKs, Binance SDKs, HTTP clients, database clients, or provider DTOs.
- Provider-specific behavior belongs behind adapters/ports.
- Shared application contracts live in `libs/contracts`.
- Normalize provider failures into `ContractResult<T>` / `ContractError` where applicable.
- Decision Engine produces provider-neutral decisions.
- Order Planner converts decisions into provider-neutral execution intents.
- Execution Engine is the only application boundary that turns an execution intent into an actual order operation.
- SSI integration remains behind the existing SSI adapter/API boundary.
- Every order-changing operation must be idempotent and auditable.
- No automatic escalation of risk/lot size.
- No revenge trading.
- Unclear risk means **do not trade**.
- Major-news protection remains enabled where applicable.
- The system must support `PAPER → ASSISTED → LIVE` operation modes.

## 3. Target Lifecycle

```text
CANDIDATE
  → APPROVED
  → PLANNED
  → RISK_CHECKED
  → READY
  → ORDER_SUBMITTED
  → PARTIALLY_FILLED
  → FILLED
  → HOLDING
  → EX_DIVIDEND
  → T2_PENDING
  → DIVIDEND_CONFIRMED
  → EXIT_READY
  → EXIT_SUBMITTED
  → CLOSED
  → SLOT_RECYCLED
```

Failure/recovery paths must be explicit rather than silently resetting state.

---

# Phase 0 — Foundation / Contract Audit

**Objective:** Lock the boundaries before adding execution behavior.

### Work

- [ ] Review the current Decision Engine contracts introduced by PR #346.
- [ ] Review existing SSI order/credential/token contracts and adapters.
- [ ] Review existing dashboard data-source boundaries.
- [ ] Define the canonical domain models for:
  - [ ] Dividend event
  - [ ] Candidate
  - [ ] Decision
  - [ ] Capital pool
  - [ ] Slot
  - [ ] Order plan
  - [ ] Execution intent
  - [ ] Order state
  - [ ] Position state
  - [ ] Dividend lifecycle
  - [ ] Trading engine state
- [ ] Define identifiers and correlation IDs used across the entire lifecycle.
- [ ] Define state-transition rules and invalid transitions.
- [ ] Define `PAPER`, `ASSISTED`, and `LIVE` behavior at contract level.
- [ ] Define idempotency requirements for every mutating command.
- [ ] Define audit/event semantics.

### Deliverable

A stable provider-neutral contract layer that all later phases can build on without leaking SSI implementation details into TCE core/UI.

---

# Phase 1 — Candidate Scanner / Dividend Intelligence

**Objective:** Turn raw market + dividend data into normalized Hunting Dividend candidates.

### 1.1 Dividend data

- [ ] Obtain dividend events from the configured market-data/source adapters.
- [ ] Normalize dividend fields:
  - symbol
  - cash dividend / dividend type
  - dividend yield where available
  - announcement date
  - ex-dividend date
  - record date
  - payment date
  - eligibility constraints
- [ ] Normalize exchange/security metadata.
- [ ] Detect missing/stale dividend data.

### 1.2 Market filters

- [ ] Liquidity filter.
- [ ] Tradability/status filter.
- [ ] Price sanity checks.
- [ ] Volume/turnover checks.
- [ ] Volatility checks.
- [ ] Corporate-action / abnormal-event checks.
- [ ] Avoid candidates with insufficient data.

### 1.3 Hunting Dividend candidate score

- [ ] Define candidate scoring inputs.
- [ ] Define the dividend-window rule (initially the 30-day candidate window).
- [ ] Calculate expected entry/exit economics.
- [ ] Calculate dividend-related return contribution.
- [ ] Calculate downside/risk metrics.
- [ ] Produce deterministic candidate reasons.
- [ ] Store scanner snapshot/version for auditability.

### Deliverable

`CandidateScanner → Candidate[]` with normalized, explainable candidates ready for the Decision Engine.

---

# Phase 2 — Hunting Dividend Decision Engine

**Objective:** Convert candidates into explicit trading decisions.

### Work

- [ ] Productionize the current `HuntingDividendDecisionEngine`.
- [ ] Define approval/rejection criteria.
- [ ] Define confidence score semantics.
- [ ] Define decision reasons and rejection reasons.
- [ ] Define invalidation conditions.
- [ ] Define entry price policy.
- [ ] Define initial target policy (`+5%` TP intent).
- [ ] Define maximum holding/lifecycle constraints.
- [ ] Prevent duplicate decisions for the same candidate/slot/window.
- [ ] Version the decision strategy.
- [ ] Persist decision snapshots.

### Canonical output

```ts
Decision {
  symbol: string;
  action: "BUY" | "HOLD" | "REJECT";
  confidence: number;
  pool: "A" | "B" | "C";
  slot: number;
  entry: number;
  target: number;
  invalidation?: number;
  reason: string[];
  strategyVersion: string;
}
```

### Deliverable

Deterministic, provider-neutral Hunting Dividend decisions with enough context to explain why a trade was or was not selected.

---

# Phase 3 — Capital A/B/C Allocator + Slot State Machine

**Objective:** Make capital and concurrent positions deterministic.

## 3.1 Capital pools

- [ ] Implement pools A/B/C as first-class state.
- [ ] Define configured capital per pool.
- [ ] Track allocated, reserved, available, and realized capital.
- [ ] Prevent over-allocation.
- [ ] Handle partially filled orders.
- [ ] Release capital on cancellation/rejection/close.

## 3.2 Slot manager

- [ ] Define slot count/configuration.
- [ ] Assign candidate → pool → slot deterministically.
- [ ] Persist slot ownership.
- [ ] Implement slot states.
- [ ] Prevent two live trades from owning the same slot.
- [ ] Support independent slot rotation.
- [ ] Support slot recycle after position closure.
- [ ] Handle orphan/stuck slots.

### Deliverable

A persistent allocator/state machine that can answer at any time: **which pool, which slot, how much capital, and which lifecycle state?**

---

# Phase 4 — Order Planner

**Objective:** Convert a Decision into an executable but provider-neutral order plan.

### Work

- [ ] Calculate quantity from pool capital and planned entry.
- [ ] Apply lot-size / board-lot rules.
- [ ] Calculate notional value.
- [ ] Calculate TP price (`+5%` initially).
- [ ] Calculate risk/invalidation price where applicable.
- [ ] Validate buying power.
- [ ] Validate available slot/capital.
- [ ] Validate price/quantity precision.
- [ ] Apply minimum/maximum order constraints.
- [ ] Generate deterministic client request ID / idempotency key.
- [ ] Produce an `ExecutionIntent`.

### Example

```text
Decision
   ↓
OrderPlanner
   ├── pool = A
   ├── slot = 2
   ├── capital = X
   ├── entry = 28,500
   ├── quantity = N
   ├── TP = 29,925
   ├── risk = validated
   └── idempotencyKey = ...
          ↓
ExecutionIntent
```

### Deliverable

`Decision → OrderPlan → ExecutionIntent`, with no SSI-specific DTOs leaking into the planner.

---

# Phase 5 — Risk / Safety Gate

**Objective:** Make safety an enforceable gate, not a UI convention.

### Work

- [ ] Enforce max risk per trade.
- [ ] Enforce available capital/buying power.
- [ ] Enforce slot availability.
- [ ] Enforce max concurrent exposure.
- [ ] Reject unclear risk.
- [ ] Reject stale market/dividend data.
- [ ] Reject invalid/stale execution intents.
- [ ] Add major-news protection where required.
- [ ] Add global engine kill switch.
- [ ] Add pool-level kill switch.
- [ ] Add symbol-level block/allow rules.
- [ ] Ensure manual override is explicit and auditable.

### Deliverable

No execution can bypass the safety gate, regardless of whether the trigger comes from UI, scheduler, or automation.

---

# Phase 6 — Execution Engine + SSI Adapter

**Objective:** Connect approved execution intents to real SSI order operations.

### 6.1 Execution contract

- [ ] Define provider-neutral execution commands/results.
- [ ] Define submit/cancel/replace behavior as supported.
- [ ] Define execution error taxonomy.
- [ ] Define provider order IDs and client request IDs.
- [ ] Normalize SSI responses/errors.

### 6.2 SSI integration

- [ ] Wire the existing SSI trading-token lifecycle into execution.
- [ ] Ensure access/refresh/approval requirements are handled by the adapter layer.
- [ ] Handle expired trading authorization before order submission.
- [ ] Handle OTP/approval flows where required.
- [ ] Keep SSI SDK/HTTP details outside the TCE domain.
- [ ] Ensure execution uses the correct account/environment.

### 6.3 Execution modes

**PAPER**

- [ ] Simulate submission/fill/cancel.

**ASSISTED**

```text
Decision
 → Planner
 → Risk Gate
 → READY
 → User Approval
 → SSI
```

**LIVE**

```text
Decision
 → Planner
 → Risk Gate
 → SSI
```

### Deliverable

A safe execution boundary capable of submitting real SSI orders without coupling the strategy to SSI internals.

---

# Phase 7 — Order Reconciliation

**Objective:** Make local engine state converge with broker truth.

### Work

- [ ] Poll/fetch open orders.
- [ ] Fetch order details/status.
- [ ] Map provider order statuses to canonical states.
- [ ] Reconcile local submitted orders against SSI.
- [ ] Detect unknown/orphan orders.
- [ ] Detect missing provider orders.
- [ ] Handle partial fills.
- [ ] Handle rejected/cancelled/expired orders.
- [ ] Retry only when retry is safe/idempotent.
- [ ] Prevent duplicate submissions after timeout/unknown response.
- [ ] Persist reconciliation results.
- [ ] Emit lifecycle events.

### Deliverable

The engine can recover from process restarts, network failures, delayed responses, and provider-side state changes.

---

# Phase 8 — Position Reconciliation

**Objective:** Make position truth authoritative and restart-safe.

### Work

- [ ] Fetch current SSI positions.
- [ ] Normalize holdings/average price/quantity.
- [ ] Reconcile local positions against broker state.
- [ ] Detect unexpected positions.
- [ ] Detect missing local positions.
- [ ] Track realized/unrealized P&L.
- [ ] Track reserved vs released capital.
- [ ] Rebuild slot state from authoritative position/order data after restart.
- [ ] Handle manual orders outside TCE.

### Deliverable

After restart or partial failure, the engine can reconstruct the actual trading state instead of trusting stale in-memory state.

---

# Phase 9 — Dividend + Ex-Dividend + T+2 Lifecycle

**Objective:** Treat dividend trading as a lifecycle, not simply a BUY → SELL strategy.

### Work

- [ ] Persist ex-dividend date.
- [ ] Persist record date.
- [ ] Persist expected payment date.
- [ ] Determine holding eligibility.
- [ ] Track position through ex-dividend.
- [ ] Track T+2 settlement eligibility.
- [ ] Reconcile settlement/position availability.
- [ ] Confirm dividend event/payment where data permits.
- [ ] Handle dividend adjustments/corporate actions.
- [ ] Detect missing/late dividend events.
- [ ] Record dividend confirmation evidence.

### Deliverable

A position can move through `HOLDING → EX_DIVIDEND → T2_PENDING → DIVIDEND_CONFIRMED` with persistent state and audit history.

---

# Phase 10 — Exit / Take Profit +5%

**Objective:** Close positions according to the Hunting Dividend exit policy.

### Work

- [ ] Monitor target price.
- [ ] Determine whether TP is executable under current market state.
- [ ] Create exit execution intent.
- [ ] Pass exit through risk/safety gate.
- [ ] Submit exit order via execution engine.
- [ ] Reconcile fill/partial fill/cancel.
- [ ] Handle manual exit.
- [ ] Handle emergency exit.
- [ ] Persist exit reason.
- [ ] Record realized P&L.
- [ ] Include dividend contribution where confirmed.

### Initial policy

```text
Entry → +5% target → Exit
```

The strategy must not assume that the target will always be filled; order and position reconciliation remain authoritative.

---

# Phase 11 — Slot Recycle + Continuous Hunting Loop

**Objective:** Automatically return completed capacity to the scanner.

### Work

- [ ] Mark position/slot `CLOSED` only after authoritative reconciliation.
- [ ] Release capital.
- [ ] Mark slot available.
- [ ] Emit `SLOT_RECYCLED` event.
- [ ] Trigger next candidate scan.
- [ ] Prevent immediately re-entering the same invalid candidate/window.
- [ ] Maintain per-slot history.
- [ ] Maintain pool utilization metrics.

### Continuous loop

```text
Scan
 → Decide
 → Allocate
 → Plan
 → Risk Gate
 → Execute
 → Reconcile
 → Hold
 → Dividend Lifecycle
 → Exit
 → Close
 → Recycle
 → Scan Again
```

---

# Phase 12 — Persistence + Event/Audit Layer

**Objective:** Make every decision and state transition explainable and recoverable.

### Data to persist

- [ ] Engine configuration.
- [ ] Strategy version.
- [ ] Scanner run.
- [ ] Candidate snapshot.
- [ ] Decision snapshot.
- [ ] Capital pool state.
- [ ] Slot state/history.
- [ ] Order plan.
- [ ] Execution intent.
- [ ] Provider order IDs.
- [ ] Order reconciliation events.
- [ ] Position reconciliation events.
- [ ] Dividend lifecycle events.
- [ ] Exit events.
- [ ] Kill-switch/manual override events.

### Audit requirements

- [ ] Every state transition has timestamp + correlation ID.
- [ ] Every decision records reasons.
- [ ] Every order records who/what triggered it.
- [ ] Manual actions are attributable.
- [ ] Strategy/config changes are versioned.

---

# Phase 13 — Reliability / Recovery / Idempotency

**Objective:** Make the engine safe under failures.

### Work

- [ ] Idempotent order submission.
- [ ] Idempotent cancel/exit commands.
- [ ] Retry policy with bounded backoff.
- [ ] Timeout handling.
- [ ] Provider outage handling.
- [ ] Trading-token expiration handling.
- [ ] Scheduler/job retry handling.
- [ ] Process restart recovery.
- [ ] Database transaction boundaries.
- [ ] Concurrency locking around pool/slot allocation.
- [ ] Duplicate-event protection.
- [ ] Dead-letter/error state for unrecoverable actions.
- [ ] Recovery tooling/manual reconciliation command.

### Critical rule

**Never interpret an unknown execution response as a safe failure.** Reconcile provider state before deciding whether another order can be submitted.

---

# Phase 14 — Engine Runtime / Scheduler / Orchestration

**Objective:** Turn individual services into one continuously operating engine.

### Work

- [ ] Engine registry.
- [ ] Engine lifecycle: start/stop/pause/resume.
- [ ] Hunting Dividend engine runtime.
- [ ] Scheduled market scans.
- [ ] Decision cycle scheduler.
- [ ] Order reconciliation scheduler.
- [ ] Position reconciliation scheduler.
- [ ] Dividend/T+2 lifecycle scheduler.
- [ ] TP monitoring loop.
- [ ] Slot recycle trigger.
- [ ] Market-session awareness.
- [ ] Safe behavior outside trading hours.
- [ ] Graceful shutdown.
- [ ] Resume after restart.

---

# Phase 15 — Dashboard / UX Full Lifecycle

**Objective:** Expose the real engine state rather than a static strategy demo.

## Engine page

- [ ] Engine status: stopped / running / paused / error.
- [ ] Mode: PAPER / ASSISTED / LIVE.
- [ ] Start / pause / resume / stop.
- [ ] Kill switch.
- [ ] Last scan / next scan.
- [ ] Health status.

## Capital / slots

- [ ] Pool A/B/C capital cards.
- [ ] Available vs allocated capital.
- [ ] Slot occupancy.
- [ ] Slot lifecycle.
- [ ] Rotation history.

## Decision queue

- [ ] Candidates.
- [ ] Decision score/confidence.
- [ ] Decision reason.
- [ ] Planned entry.
- [ ] Planned quantity.
- [ ] TP.
- [ ] Risk status.
- [ ] READY / APPROVE / REJECT actions in ASSISTED mode.

## Execution

- [ ] Order status.
- [ ] Provider order ID.
- [ ] Partial fill state.
- [ ] Execution errors.
- [ ] Reconciliation status.

## Position lifecycle

- [ ] Entry/fill.
- [ ] Holding.
- [ ] Ex-dividend.
- [ ] T+2.
- [ ] Dividend confirmation.
- [ ] TP readiness.
- [ ] Exit.
- [ ] Closed/recycled.

## Observability

- [ ] Engine event timeline.
- [ ] Audit log.
- [ ] Error/recovery queue.
- [ ] Reconciliation warnings.

---

# Phase 16 — Notifications / Operations

**Objective:** Surface only actionable events.

### Notifications

- [ ] Engine started/stopped/paused.
- [ ] Candidate approved.
- [ ] Assisted approval required.
- [ ] Order submitted.
- [ ] Order filled/rejected.
- [ ] Reconciliation mismatch.
- [ ] Position unexpectedly changed.
- [ ] Dividend lifecycle milestone.
- [ ] TP reached / exit submitted.
- [ ] Slot recycled.
- [ ] Kill switch triggered.
- [ ] Critical provider/token failure.

### Channels

- [ ] In-app event feed.
- [ ] Telegram integration.
- [ ] Optional future channels behind notification contracts.

---

# Phase 17 — Testing / Simulation / Production Readiness

**Objective:** Prove the full lifecycle before LIVE mode.

## Unit tests

- [ ] Candidate normalization.
- [ ] Dividend scoring.
- [ ] Decision engine.
- [ ] Capital allocation.
- [ ] Slot transitions.
- [ ] Order planning.
- [ ] Risk gate.
- [ ] Lifecycle transitions.

## Contract tests

- [ ] SSI adapter contract.
- [ ] Execution contract.
- [ ] Reconciliation contract.
- [ ] Provider error normalization.

## Integration tests

- [ ] Scanner → Decision.
- [ ] Decision → Planner.
- [ ] Planner → Risk.
- [ ] Risk → Execution.
- [ ] Execution → SSI.
- [ ] SSI → Reconciliation.
- [ ] Position → Dividend lifecycle.
- [ ] Exit → Recycle.

## Failure simulations

- [ ] Network timeout after order submission.
- [ ] Duplicate submit attempt.
- [ ] Token expiry before submit.
- [ ] Partial fill.
- [ ] Provider rejection.
- [ ] Process restart while order is open.
- [ ] DB unavailable during transition.
- [ ] Stale dividend data.
- [ ] Manual broker-side order.

## Rollout

- [ ] PAPER mode.
- [ ] Historical/backtest validation where practical.
- [ ] Assisted mode.
- [ ] Small controlled LIVE rollout.
- [ ] Expand only after reconciliation and safety metrics are stable.

---

# Phase 18 — Performance / Monitoring / Operational Metrics

**Objective:** Know whether the engine is healthy and whether the strategy is behaving as intended.

### Metrics

- [ ] Scan duration.
- [ ] Candidates scanned.
- [ ] Candidate approval rate.
- [ ] Decision confidence distribution.
- [ ] Orders planned/submitted/filled/rejected.
- [ ] Fill rate.
- [ ] Reconciliation mismatch rate.
- [ ] Average capital utilization by pool.
- [ ] Slot utilization/turnover.
- [ ] Dividend confirmation rate.
- [ ] TP hit rate.
- [ ] Average holding duration.
- [ ] Realized P&L.
- [ ] Dividend contribution.
- [ ] Execution latency.
- [ ] Provider/API error rate.

### Alerts

- [ ] Stale market data.
- [ ] Stale dividend data.
- [ ] Reconciliation mismatch.
- [ ] Unexpected position.
- [ ] High order rejection rate.
- [ ] Token/authorization failure.
- [ ] Engine stuck state.
- [ ] Slot stuck beyond threshold.

---

# Cross-Phase State Model

The implementation should converge on a single canonical state machine rather than separate ad-hoc status fields.

```text
Candidate
  ↓
Decision
  ↓
Allocation
  ↓
OrderPlan
  ↓
RiskGate
  ↓
ExecutionIntent
  ↓
Order
  ↓
Fill
  ↓
Position
  ↓
ExDividend
  ↓
T+2
  ↓
DividendConfirmed
  ↓
ExitReady
  ↓
ExitOrder
  ↓
Closed
  ↓
SlotRecycled
```

Every transition should have:

```text
entityId
fromState
 toState
timestamp
reason
actor/source
correlationId
strategyVersion
```

---

# Suggested Implementation Order

The implementation order is intentionally dependency-driven:

```text
1. Contract Audit
       ↓
2. Candidate Scanner / Normalizer
       ↓
3. Decision Engine productionization
       ↓
4. Capital A/B/C + Slot State Machine
       ↓
5. Order Planner + ExecutionIntent
       ↓
6. Risk / Safety Gate
       ↓
7. Execution Engine + SSI Adapter
       ↓
8. Order Reconciliation
       ↓
9. Position Reconciliation
       ↓
10. Dividend / Ex-Dividend / T+2 lifecycle
       ↓
11. Exit / +5% TP
       ↓
12. Slot Recycle
       ↓
13. Persistence + Audit
       ↓
14. Runtime / Scheduler
       ↓
15. Dashboard full lifecycle
       ↓
16. Notifications
       ↓
17. Test / Simulation / PAPER
       ↓
18. Assisted
       ↓
19. Controlled LIVE
```

---

# Immediate Next Milestone

The highest-value next implementation after the current Decision Engine dashboard is:

### **Order Planner + Capital/Slot State Machine + ExecutionIntent**

Why:

- It bridges the current decision layer to actual execution.
- It establishes the A/B/C capital model.
- It establishes deterministic slot ownership/rotation.
- It gives SSI a clean provider-neutral input.
- It allows the next phases to add risk gating, execution, and reconciliation without redesigning the strategy layer.

Target flow for this milestone:

```text
Candidate
 → Decision
 → Capital/Slot Allocation
 → Order Planner
 → Risk Check
 → ExecutionIntent
```

**No real order submission is required in this milestone.** The output should be deterministic, persistable, auditable, and ready for the future Execution Engine.

---

# Definition of Done — Full Flow

The Hunting Dividend engine is considered full-flow complete only when all of the following are true:

- [ ] Market/dividend data can produce normalized candidates.
- [ ] Candidates can produce explainable decisions.
- [ ] Decisions allocate capital and slots deterministically.
- [ ] Planner produces valid execution intents.
- [ ] Safety gate can block unsafe actions.
- [ ] SSI execution can submit approved intents.
- [ ] Orders reconcile against broker truth.
- [ ] Positions reconcile against broker truth.
- [ ] Ex-dividend and T+2 lifecycle is tracked.
- [ ] Dividend confirmation is persisted.
- [ ] +5% TP exit is planned/executed/reconciled.
- [ ] Closed positions release capital and recycle slots.
- [ ] Engine can continuously scan for the next opportunity.
- [ ] Restart/recovery does not create duplicate orders.
- [ ] Every material action is auditable.
- [ ] PAPER and ASSISTED modes work before LIVE.
- [ ] Kill switch and operational safeguards are functional.
- [ ] Dashboard exposes the real lifecycle.
- [ ] Notifications surface critical/actionable events.
- [ ] Automated tests cover normal and failure paths.

## Non-goals for the first full-flow release

- Multi-strategy orchestration beyond Hunting Dividend.
- Fully autonomous optimization of strategy parameters.
- Automatic leverage/risk escalation.
- Provider-specific logic inside the strategy/domain layer.
- Complex derivatives execution in the SSI flow.

These can be added later through new contracts/adapters without changing the core lifecycle.
