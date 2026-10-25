# Binance Futures Engine

The Binance engine is the execution/reconciliation worker behind TCE Telegram signals.

## Signal lifecycle

`QUEUED -> ACCEPTED -> EXECUTED`

- `QUEUED`: Telegram signal has been parsed and persisted.
- `ACCEPTED`: entry order exists or is being monitored.
- `EXECUTED`: a live Binance position was found and both TP and SL were verified.
- `FAILED`: the engine could not safely execute or protect the signal.

## Execution rules

1. One active symbol per account/environment is enforced by the signal guard and again at the Binance exchange before creating an entry.
2. Entry is a single LIMIT order at the normalized `ENTRY` price.
3. The engine never invents order quantity. `binance_order_quantity` must be configured explicitly.
4. Once a position exists, the engine reconciles Binance open orders every 5 seconds.
5. If SL is missing, SL is created first. TP is created only after SL has been verified.
6. TP and SL are reduce-only exit orders and use the opposite side of the position.
7. If an API call times out, the next reconciliation reads Binance state before creating anything again, preventing blind duplicate orders.
8. Binance remains the source of truth for position/order state; Supabase stores signal lifecycle and audit state.

## Configuration API

- `GET /tce/engine/binance/config`
- `PATCH /tce/engine/binance/config`

Example:

```json
{
  "enabled": true,
  "quantity": 0.001,
  "positionSide": "BOTH"
}
```

## Manual reconciliation

`POST /tce/engine/binance/scan` runs one reconciliation cycle. The service also runs the same scan automatically every 5 seconds on the VPS.
