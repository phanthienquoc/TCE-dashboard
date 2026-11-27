# Stock events

TCE consumes upcoming corporate/dividend events from the existing `stockdividend` service, whose source of truth is MongoDB Atlas `vietstock.events`. This keeps the stock-dividend schema owned by `stockdividend` while TCE exposes a stable authenticated API for its UI.

Environment:

- `STOCK_EVENTS_API_URL` (default: `http://stock-backend:8080/api/stocks`)

API: `GET /stock-events?limit=100` with the normal dashboard bearer token. The default is 100 and the service caps requests at 200 events.

A ticker can legitimately have multiple dividend events in the same year (including 2–3 payments). The UI therefore does **not** deduplicate by ticker. It only collapses an exact duplicate of ticker + ex-date + event content.

## Vietstock crawler runtime

The service image installs Chrome Headless Shell in Puppeteer's platform-specific cache at `PUPPETEER_CACHE_DIR`. Keep the executable together with its adjacent `icudtl.dat`, `locales`, and other browser resources. Do not copy the binary to a standalone path or set `PUPPETEER_EXECUTABLE_PATH` to a detached copy: Chromium may fail at startup with an ICU data file-descriptor error. The image build validates the cached executable and its ICU/locales resources before publishing.
