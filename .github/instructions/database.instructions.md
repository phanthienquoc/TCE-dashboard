---
applyTo: "**/*.{sql,prisma}"
---

# Database and Supabase Instructions

## Discovery
- Read the migration history, current schema/types, relevant queries, RLS policies, triggers, indexes, and application consumers.
- Establish the migration tool and naming/order convention from the repository; do not invent a parallel migration path.
- Verify the target project/ref from authoritative configuration before any remote action. A placeholder, branch name, or guessed URL is not evidence.

## Schema design
- Prefer additive, backward-compatible expand/migrate/contract changes for rolling deployments.
- Define appropriate constraints, foreign keys, indexes, nullability, defaults, and ownership semantics.
- Review query plans and index tradeoffs for high-volume paths where relevant.
- Enable and verify RLS for exposed tables and write policies that express least privilege. Do not assume service-role access is equivalent to user authorization.
- Consider lock duration, table size, backfill strategy, transaction semantics, replication/realtime effects, and rollback feasibility.
- Avoid destructive changes until all callers and data dependencies have been accounted for.
- Keep generated database types and query code synchronized when the project workflow requires it.

## Execution safety
- Never print or commit database credentials, access tokens, service-role keys, or production rows.
- Do not apply migrations or mutate production data unless the user explicitly authorizes it and the exact target is independently verified.
- Distinguish writing a migration, validating it locally, applying it remotely, and verifying the deployed schema; these are different states.
- If migration history has drift, inspect actual remote/local state and propose a reconciled migration plan rather than blindly overwriting history.

## Evidence
- Report migration filename, checks performed, target identity evidence (without secrets), execution result, and any destructive/rollback limitations.
- Do not claim a migration was applied based only on file creation or a successful local diff.
