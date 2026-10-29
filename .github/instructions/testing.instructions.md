---
applyTo: "**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,py}"
---

# Testing Instructions

- Review the behavior and existing tests before changing expectations.
- Prefer deterministic tests; mock external APIs, clocks, random sources, and databases where appropriate.
- Cover success, boundary, invalid-input, and failure paths proportional to risk.
- Never send real orders, mutate production data, or depend on private credentials for ordinary tests.
- Use existing test framework and test patterns; do not introduce a new runner without justification.
- Report skipped tests and environmental limitations explicitly.
