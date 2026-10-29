---
name: database-migration
description: Use for Supabase schema, SQL migrations, RLS, generated types, or data-access contract changes.
---

# Database Migration Skill

## Discovery
1. Identify the repository's migration mechanism, naming/order conventions, current migration history, schema, RLS policies, triggers, and generated types.
2. Trace all affected queries and application consumers.
3. Verify the target project/ref from authoritative configured metadata before remote action; never guess from placeholders or repository names.

## Design
4. Prefer additive, backward-compatible changes and expand/migrate/contract rollout when multiple application versions may coexist.
5. Review constraints, nullability, indexes, query impact, RLS, grants, triggers, realtime, locking, table size, and backfill requirements.
6. Identify destructive operations, data-loss risks, transaction behavior, and rollback limitations explicitly.
7. Update generated types and dependent code according to the repository workflow.

## Validation and execution
8. Validate SQL and migration ordering with available tooling; use a safe non-production target for integration checks when available.
9. Never expose secrets or production data.
10. Never apply production changes unless explicitly authorized and the target is verified.
11. Distinguish migration authored, locally validated, remotely applied, and deployed schema verified.
12. Report migration identity, checks performed, authoritative target evidence without secrets, execution outcome, and recovery limitations.
