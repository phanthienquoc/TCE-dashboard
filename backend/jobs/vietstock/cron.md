# Cron deployment contract

The container entrypoint is `python -m app`.

Recommended scheduler contract:

- Daily sync: `0 1 * * *` (UTC)
- Manual execution: `workflow_dispatch`
- Required secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

The job is idempotent because events are upserted by `event_key`.
