# TCE Flow

```mermaid
flowchart TD
    A[Market Data / Corporate Actions] --> B[TCE Market Scanner]
    B --> C[Pool 5\ntce_pool_entries]

    C --> D{Position slots available?}
    D -- No: 2/2 positions --> M[T+2 Position Monitor\nEvery 1h during VN market hours]
    D -- Yes --> E{Candidate passes\nTCE rules?}

    E -- No --> C
    E -- Yes --> F[Promote selected candidate\ntce_buy_candidates]
    F --> G[Buy Decision / Execution]
    G --> H[Open Position\ntce_positions]

    H --> M
    M --> N[Position Snapshot\ntce_position_snapshots]
    N --> O{Signal}

    O -- HOLD / WATCH --> M
    O -- TAKE PROFIT --> P[Partial / Full Exit]
    O -- CASHOUT --> P
    O -- CUT --> P

    P --> Q[Order / Execution\ntce_orders]
    Q --> R[Cashout Event\ntce_cashout_events]
    R --> S[Cashflow Ledger\ntce_cashflows]
    S --> T[Cycle Result\ntce_cycles]
    T --> U[Capital Recycled]
    U --> C

    M --> V[Monitor Audit\ntce_monitor_runs]

    W[TCE Strategy Config\n15M Core + 5M Burst\nMax 2 Positions / Pool 5] -.-> B
    W -.-> M
    W -.-> F
```

## Operating rules

- **Pool:** always maintain up to 5 ranked candidates when capacity is available.
- **Positions:** maximum 2 open positions at the same time.
- **Monitor:** active T+2 positions are monitored every 60 minutes during Vietnam equity market sessions only.
- **When 2/2 positions are open:** skip pool hunting; monitor only.
- **When a position closes:** free the slot and refill Pool 5.
- **Capital:** 15,000,000 VND core capital + up to 5,000,000 VND burst capital.
- **Pool vs execution:** `tce_pool_entries` stores research/scoring intelligence; `tce_buy_candidates` stores only promoted execution candidates.
- **Cashout loop:** position exit → cashout event → cashflow → cycle result → capital recycled into the next opportunity.
