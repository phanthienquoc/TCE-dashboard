# TCE Decision Engine Architecture

## Purpose

Decision Engines are strategy-specific decision modules. They consume normalized stock/candidate data and portfolio/capital state, then produce a provider-neutral trade decision. They must not call SSI, Supabase, Binance, or other provider SDKs directly.

## Pipeline

```text
Stock List / Market Data
        |
        v
Decision Engine
  - candidate filtering
  - ranking / scoring
  - BUY / SELL / WAIT decision
  - pool / slot selection
  - capital allocation
        |
        v
Order Planner
  - available capital
  - current/reference price
  - lot size / quantity rules
  - entry / TP / SL normalization
        |
        v
Execution Engine
  - submit order
  - track broker order state
  - fill / reject / cancel
  - T+2 / sellability state
```

## Boundary rules

### Decision Engine owns

- Strategy logic and candidate selection.
- Strategy-specific eligibility and scoring.
- Capital pool selection (for example A/B/C) and allocation intent.
- A provider-neutral decision record and explanation/reason codes.

### Order Planner owns

- Converting allocation intent into an executable order quantity.
- VN equity lot-size rounding.
- Entry price limits and derived TP/SL levels.
- Rejecting orders that exceed the capital actually available to the slot/pool.

### Execution Engine owns

- Broker/provider communication.
- Order submission and lifecycle tracking.
- Broker truth for order status and fills.
- Position updates and T+2 sellability handling.

Decision Engines must never depend on broker-specific request/response DTOs.

## First implementation: Hunting Dividend Engine

The Hunting Dividend Engine receives normalized stock-event candidates such as:

```ts
{
  symbol: 'SGS',
  gdkhq_timestamp: '2026-01-13T00:00:00.000Z',
  dividendValue: 6750,
  price: 14870,
  real_pnl: 0.4539340954942838,
  exchange: 'UPCoM',
  ratio: '67.50%'
}
```

Its initial rules are:

- Candidate window: dividend event within the configured lookback window (default 30 calendar days relative to the decision timestamp).
- Capital model: split deployable capital into three equal pools A/B/C.
- Pool slots operate independently; a completed/sold slot can rotate into the next eligible candidate without waiting for other slots.
- Target profit: configurable, initially +5% from actual filled entry price.
- Candidate selection must exclude symbols already occupying another active slot unless the strategy explicitly allows reuse.
- Strategy output is intent only; quantity is finalized by the Order Planner.

## Capital rotation

Each pool is modeled as independent slots. When a slot is released after a completed exit, its allocation returns to the planner/allocator and may be assigned to the next eligible candidate.

```text
Pool A: A1 -> SGS -> SELL -> next candidate
Pool B: B1 -> ABC -> SELL -> next candidate
Pool C: C1 -> XYZ -> SELL -> next candidate
```

T+2 states are explicit and must not be treated as immediately available cash or sellable shares.

Recommended accounting states:

```text
cash_available
cash_pending
stock_sellable
stock_pending_t2
```

## Decision contract

A decision should remain provider-neutral and contain enough information for planning and audit:

```ts
{
  engine: 'hunting_dividend',
  decision: 'BUY',
  symbol: 'SGS',
  allocation: {
    pool: 'A',
    slot: 'A1',
    capital: 10_000_000
  },
  entry: {
    type: 'MARKET',
    maxPrice: 14950
  },
  exit: {
    tpPercent: 5
  },
  constraints: {
    maxHoldDays: 30,
    t2Required: true
  },
  confidence: 0.78,
  reasons: ['dividend_event_in_window', 'candidate_ranked']
}
```

## Observability and `/pools`

The `/pools` route is the operational dashboard for the currently selected Decision Engine, initially Hunting Dividend.

It should surface:

- Engine status and current configuration.
- Pool A/B/C capital, available/pending/used amounts and occupied slots.
- Active positions with pool/slot, filled entry, quantity, current price, TP, P/L and T+2 state.
- Candidate ranking and the most recent decisions (BUY / SELL / SKIP / WAIT) with reasons.
- Rotation history showing which slot was released and which candidate replaced it.

The UI is observational/control-plane UI. It must not contain broker execution logic.

## Extensibility

Additional Decision Engines should implement the same decision contract:

```text
Hunting Dividend  \
Breakout           \
Momentum            +--> Decision Contract --> Order Planner --> Execution Engine
Mean Reversion     /
```

A future Decision Aggregator may consume outputs from multiple engines, apply global risk constraints, and emit the final decision without changing the Execution Engine boundary.
