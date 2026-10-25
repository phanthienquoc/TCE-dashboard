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
  - capital allocation intent
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
- Capital pool selection (A/B/C) and allocation intent.
- Provider-neutral decision records and explanation/reason codes.

### Order Planner owns

- Converting allocation intent into executable quantity.
- VN equity lot-size rounding.
- Entry price limits and derived TP/SL levels.
- Rejecting orders that exceed capital actually available to the slot/pool.

### Execution Engine owns

- Broker/provider communication.
- Order submission and lifecycle tracking.
- Broker truth for order status and fills.
- Position updates and T+2 sellability handling.

Decision Engines never depend on broker-specific request/response DTOs.

## First implementation: Hunting Dividend Engine

The Hunting Dividend Engine receives normalized stock-event candidates such as:

```ts
{
  symbol: 'SGS',
  gdkhqTimestamp: '2026-01-13T00:00:00.000Z',
  dividendValue: 6750,
  price: 14870,
  realPnl: 0.4539340954942838,
  exchange: 'UPCoM',
  dividendRatio: '67.50%'
}
```

Initial rules:

- Candidate window: dividend event within configured lookback (default 30 calendar days relative to the decision timestamp).
- Capital model: deployable capital split into three equal pools A/B/C.
- Pool slots operate independently; when a slot exits, it can rotate into the next eligible candidate without waiting for other slots.
- Target profit: configurable, initially +5% from the actual filled entry price.
- A symbol already occupying an active slot is excluded from new allocation by default.
- Strategy output is intent only; quantity is finalized by the Order Planner.

## Capital rotation

Each pool is modeled as independent slots. When a slot is released after a completed exit, its allocation returns to the allocator and may be assigned to the next eligible candidate.

```text
Pool A: A1 -> SGS -> SELL -> next candidate
Pool B: B1 -> ABC -> SELL -> next candidate
Pool C: C1 -> XYZ -> SELL -> next candidate
```

T+2 is explicit state and must not be treated as immediately available cash or sellable shares.

Recommended accounting states:

```text
cash_available
cash_pending
stock_sellable
stock_pending_t2
```

## Decision contract

```ts
{
  engine: 'hunting_dividend',
  decision: 'BUY',
  symbol: 'SGS',
  pool: 'A',
  slot: 'A1',
  capital: 10_000_000,
  maxPrice: 14950,
  tpPercent: 5,
  maxHoldDays: 30,
  confidence: 0.78,
  reasons: ['dividend_event_in_window', 'candidate_ranked'],
  timestamp: '2026-09-09T00:00:00.000Z'
}
```

## `/pools` operational dashboard

`/pools` replaces the old pool-only opportunity view and becomes the operational dashboard for the selected Decision Engine, initially Hunting Dividend.

It surfaces:

- Engine status and core configuration.
- Pool A/B/C allocation, available/pending capital and occupied slots.
- Active positions with pool/slot, entry, quantity, live price, TP, P/L and T+2 state when present.
- Decision queue/candidate ranking with BUY/SKIP/WAIT intent, score and dividend context.
- The rotation pipeline from candidate -> decision -> planner -> execution.

The UI is observational/control-plane UI; broker execution remains behind the Execution Engine and existing trade actions.

## Extensibility

```text
Hunting Dividend  \
Breakout           \
Momentum            +--> Decision Contract --> Order Planner --> Execution Engine
Mean Reversion     /
```

A future Decision Aggregator may combine multiple engines, apply global risk constraints and emit a final decision without changing the Execution Engine boundary.
