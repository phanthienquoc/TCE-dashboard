---
applyTo: "apps/web/**/*.{ts,tsx,js,jsx,css}"
---

# Frontend Instructions

- Inspect nearby components, hooks, API helpers, state management, and tests before changing a feature.
- Preserve the mobile-first/iOS Safari experience and existing route behavior.
- Use the repository's explicit TypeScript import aliases and existing component/design-system conventions; avoid adding broad wildcard aliases.
- Keep network concerns, state transitions, and presentation appropriately separated.
- Handle loading, empty, error, and stale-data states when relevant.
- Avoid introducing client/server boundary violations, hydration mismatches, unsafe HTML, or unbounded effects/subscriptions.
- For realtime streams, check cleanup, reconnect behavior, duplicate events, ordering, and backpressure where applicable.
- Add/update focused tests for changed behavior and run scripts discovered from package.json/project configuration.
- Do not change trading/execution behavior while making unrelated UI improvements.
