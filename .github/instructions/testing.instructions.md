---
applyTo: "**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,py}"
---

# Testing Instructions

- Follow the repository's existing test framework, naming, fixtures, and test environment.
- Prefer deterministic tests; control clocks, randomness, scheduling, and async boundaries where practical.
- Mock exchanges, brokers, Supabase, network calls, and other external services in unit tests.
- Never place real orders, mutate production data, require production credentials, or depend on external service availability for ordinary unit tests.
- Test observable behavior, not private implementation details. Avoid brittle snapshots when explicit assertions are clearer.
- Cover success, invalid input, boundaries, authorization, errors, retries/idempotency, and cleanup according to the risk of the change.
- Ensure test discovery itself fails when no intended tests are discovered; an empty successful run is not evidence.
- Keep fixtures synthetic and free of secrets or production data.
- Do not weaken or delete an assertion just to make a test pass. When expected behavior changes, explain why and update the contract.
- Run focused tests first, then relevant suite/typecheck/lint/build where feasible. Report skipped, blocked, and not-run checks explicitly.
