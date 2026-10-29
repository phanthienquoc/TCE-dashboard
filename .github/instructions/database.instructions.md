---
applyTo: "**/*.{sql,prisma}"
---

# Database and Supabase Instructions

- Inspect existing migrations, schema, queries, generated types, and callers before changing the data model.
- Keep migrations sequential, reproducible, and compatible with the repository's migration process.
- Prefer additive changes; explicitly flag destructive changes, backfills, locks, and data-loss risks.
- Verify the target project/ref using authoritative configured metadata; never rely on placeholders or guess from naming.
- Never expose secrets or copy production data into tests, documentation, logs, or commits.
- Do not run migrations against production unless the task explicitly authorizes it and the target is confirmed.
- Update relevant generated types and dependent queries when the repository's workflow requires it.
- Provide the exact validation performed; creating a migration file does not mean it was applied.
