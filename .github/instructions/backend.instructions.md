---
applyTo: "apps/service/**/*.{ts,tsx,js,jsx,py}"
---

# Backend and Service Instructions

- Confirm the service entrypoints, API contracts, data models, configuration, and caller expectations before editing.
- Validate external input at service boundaries and keep errors structured without leaking secrets.
- Use timeouts, bounded retries, idempotency, and explicit failure handling for network calls where applicable.
- Do not change order execution, portfolio sizing, risk limits, or trading schedules as a side effect of unrelated work.
- Use dependency injection or existing test seams rather than calling production services in tests.
- Add/update unit or integration tests according to established repository conventions.
- Discover actual runtime and test commands; do not assume undocumented scripts.
