---
name: database-migration
description: Use when changing Supabase schema, SQL migrations, generated database types, or data access contracts.
---

# Database Migration Skill

1. Inspect the existing schema/migration mechanism and nearby migrations.
2. Identify the authoritative project target without exposing credentials.
3. Check dependent queries, generated types, constraints, indexes, RLS policies, and application rollout order.
4. Prefer additive and backward-compatible migrations when feasible.
5. Describe data migration, locking, rollback, and destructive risks.
6. Validate SQL and migration ordering using available repository tooling.
7. Never claim deployment or application of a migration unless a real result proves it.
8. Never apply production changes unless explicitly authorized and the target is verified.
