---
name: implementation
description: Use to implement a planned, scoped change while preserving existing contracts and repository conventions.
---

# Implementation Skill

1. Confirm the approved scope, acceptance criteria, and dedicated task branch.
2. Check the working tree and avoid overwriting unexplained changes.
3. Inspect nearby patterns and choose the smallest complete implementation.
4. Preserve public contracts unless a deliberate, documented breaking change is required.
5. Add or update tests, types, docs, and migration artifacts as required.
6. Keep side effects explicit; use mocks/test seams for external services.
7. Run discovered focused checks, then broader relevant checks where feasible.
8. Review the complete diff for scope creep, secret exposure, generated noise, and regressions.
9. Report files changed, checks and exact outcomes, known gaps, and rollback concerns.

Do not use this skill to bypass review, branch protections, production safeguards, or authorization boundaries.
