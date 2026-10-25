# Dividend Rolling Engine — P3

P3 adds the T+2 settlement lifecycle to rolling positions.

- `entryAt` records the buy execution time.
- `settlementAt` and `availableAt` are calculated through `SettlementCalendarPort`.
- The default policy counts two weekdays and is replaceable by a market-holiday-aware adapter later.
- Positions move `BOUGHT -> T+2_PENDING -> AVAILABLE` only when the persisted `availableAt` is reached.
- `SettlementService.canSell()` returns false until the position is available.
- Settlement reconciliation reads persisted positions and advances only eligible T+2 positions.

The Daily Agent does not calculate settlement dates, and P3 does not add broker execution.
