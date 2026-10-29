---
applyTo: "apps/web/**/*.{ts,tsx,js,jsx,css}"
---

# Frontend Engineering Instructions

## Before changing code
- Trace the route/component through hooks, state, API clients, types, and tests.
- Inspect server/client boundaries, existing design-system components, route conventions, and import aliases.
- Keep the product mobile-first and preserve iOS Safari behavior unless requirements explicitly change it.

## Implementation
- Prefer small components with explicit props and clear state ownership; avoid unnecessary global state.
- Use existing UI primitives and established Tailwind/shadcn conventions rather than duplicating patterns.
- Preserve strict TypeScript typing. Avoid `any`, unsafe casts, non-null assertions, and duplicated domain types unless justified.
- Keep network access in the established API/service layer. Do not embed secrets or privileged credentials in client bundles.
- Model loading, empty, stale, success, and error states where relevant. Provide actionable, non-sensitive error feedback.
- Validate URL/query/form inputs at boundaries. Use accessible labels, semantic HTML, keyboard support, and visible focus states.
- Avoid hydration mismatches, browser-only access during server rendering, unsafe HTML, unbounded effects, stale closures, and memory leaks.
- Clean up event listeners, timers, subscriptions, observers, and realtime connections.
- For streaming/realtime UI, consider reconnects, duplicate/out-of-order events, backpressure, stale snapshots, and cancellation.
- Preserve responsive layout and viewport behavior. Do not introduce desktop-only assumptions into mobile-critical flows.

## Verification
- Add/update tests for behavior and meaningful UI states using the existing test framework.
- Run the relevant formatter, lint, typecheck, tests, or build only after discovering the actual commands.
- Do not change trading calculations, order execution, or risk behavior to solve a presentation issue.
