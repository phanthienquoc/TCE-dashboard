# Dividend Rolling Engine — P1

P1 introduces dividend campaigns as the top-level lifecycle for one ticker and one dividend event.

## Event identity

A campaign is uniquely identified by `symbol + eventId`. The dividend date is stored as event data, not as the sole identity. This preserves multiple legitimate dividend events for the same ticker, including recurring annual or multiple events in one year.

`eventId` may reference the source Stock Events document `_id`, allowing existing stock-event rows to seed campaigns without coupling DRE to the Stock Events module.

## Lifecycle

Campaign status is one of:

- `ACTIVE`
- `PAUSED`
- `GAP`
- `COMPLETED`
- `INVALIDATED`

## TP reference

Campaigns store a 7–10% target TP range as configuration/reference. TCE Core remains authoritative for the actual take-profit decision; DRE does not calculate or override strategy rules.

## Persistence

MongoDB collection: `dre_dividend_campaigns`.

A unique index on `campaignKey` prevents duplicate campaigns for the same event identity. Persistence is lazy and does not force a MongoDB connection during application startup.
