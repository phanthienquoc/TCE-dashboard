# Vietstock cron job

This job is a standalone TCE backend data collector. It is intentionally separated from the dashboard UI and TCE scoring logic.

## Responsibilities

- Fetch Vietstock corporate-event pages.
- Parse dividend/corporate-event rows.
- Normalize dates and dividend values.
- Upsert normalized events into Supabase.
- Be safe to run repeatedly through an idempotent event key.

## Environment

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `VIETSTOCK_BASE_URL` (default: `https://finance.vietstock.vn`)
- `VIETSTOCK_FROM_DATE` (default: `2015-01-01`)
- `VIETSTOCK_GROUP` (default: `13`)
- `VIETSTOCK_EXCHANGE` (default: `-1`)
- `VIETSTOCK_MAX_PAGES` (default: `20`)
- `VIETSTOCK_TIMEOUT` (default: `30`)
- `VIETSTOCK_USER_AGENT`

## Run

```bash
cd backend/jobs/vietstock
python -m pip install -r requirements.txt
python -m app
```

The job exits non-zero when the scrape fails, so it can be safely called from cron or GitHub Actions.
