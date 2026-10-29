---
applyTo: "apps/service/**/*.{ts,tsx,js,jsx,py}"
---

# Backend and Service Engineering Instructions

## Contracts and boundaries
- Inspect service entrypoints, routes, schemas, callers, configuration, and existing error conventions before editing.
- Validate and normalize untrusted inputs at the boundary; distinguish client errors from internal failures.
- Keep API contracts explicit and backward-compatible where practical. Update types, docs, and tests when contracts change.
- Authenticate and authorize every sensitive operation at the appropriate boundary; do not rely on frontend checks.
- Avoid leaking stack traces, SQL, tokens, secrets, or private data in responses and logs.

## Reliability
- Set timeouts for external I/O. Use bounded retries with backoff only for transient, retry-safe operations.
- Make retried operations idempotent where possible; use idempotency keys/unique constraints for durable side effects.
- Bound concurrency, queues, payload sizes, and resource usage. Handle cancellation and shutdown cleanly.
- Separate read/monitoring signals from commands that mutate positions or place orders.
- Use structured, redacted logs with correlation identifiers where available; do not log secrets or raw sensitive payloads.
- Fail explicitly and observably; do not swallow errors or return success-shaped defaults on failure.

## TCE-specific constraints
- Do not alter order execution, portfolio sizing, strategy/risk limits, or scan schedules as a side effect of unrelated service work.
- Never use live broker/exchange actions or production data mutations in tests.
- For market/execution paths, preserve ordering, idempotency, precision/rounding rules, and audit trails.

## Verification
- Use dependency injection or established test seams to isolate databases, exchanges, and third-party APIs.
- Add tests for validation, authorization, error handling, retries/idempotency, and boundary cases appropriate to the change.
- Discover real scripts and test commands from repository configuration. Report unavailable external dependencies separately from code failures.
