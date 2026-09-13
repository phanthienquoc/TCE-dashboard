# Profit Exit

The profit-exit cron evaluates open positions using the configured profit target and the retained ±7% buy-price band. Positions at or above the target are surfaced as `SELL READY`; positions below target remain tracking candidates only. HOLD symbols and invalid positions are surfaced with explicit skip reasons.

This PR intentionally does not submit broker orders. Live SSI submission remains an explicit execution step outside the cron evaluation response.
