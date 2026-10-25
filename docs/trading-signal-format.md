# TCE Trading Signal Format v1

Telegram and other signal gateways must normalize messages to this canonical format:

```text
XAUUSD BUY
ENTRY 4582
TP 4588
SL 4567
```

Single-line input is also accepted:

```text
XAUUSD BUY ENTRY 4582 TP 4588 SL 4567
```

## Rules

- One symbol per signal.
- Side is `BUY` or `SELL`.
- Exactly one entry price.
- Exactly one TP price.
- Exactly one SL price.
- BUY requires `SL < ENTRY < TP`.
- SELL requires `TP < ENTRY < SL`.
- Entry ranges are not accepted.
- Multiple TP levels are not accepted in v1.
- Invalid or ambiguous input must be rejected; the parser must never guess missing values.

The normalized signal is then passed to the TCE Engine. The gateway does not place broker orders directly.
