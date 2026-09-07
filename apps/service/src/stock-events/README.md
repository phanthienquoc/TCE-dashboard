# Stock events

TCE consumes upcoming corporate/dividend events from the existing `stockdividend` service, whose source of truth is MongoDB Atlas `vietstock.events`. This keeps the stock-dividend schema owned by `stockdividend` while TCE exposes a stable authenticated API for its UI.

Environment:
- `STOCK_EVENTS_API_URL` (default: `http://stock-backend:8080/api/stocks`)

API: `GET /stock-events?limit=100` with the normal dashboard bearer token.

A ticker can legitimately have multiple dividend events in the same year (including 2–3 payments). The UI therefore does **not** deduplicate by ticker. It only collapses an exact duplicate of ticker + ex-date + event content.
