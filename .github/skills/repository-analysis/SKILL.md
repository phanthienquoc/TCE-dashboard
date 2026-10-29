---
name: repository-analysis
description: Use before implementation when a task touches unfamiliar code, dependencies, architecture, or runtime behavior.
---

# Repository Analysis Skill

## Procedure
1. Read repository-wide instructions and the closest applicable path instructions.
2. Read the root README plus the smallest set of relevant architecture, operations, and security documents.
3. Search for the entrypoint, public API, state/data model, callers, configuration, migrations, tests, and related workflows.
4. Trace the behavior end-to-end across frontend, service, database, and infrastructure where applicable.
5. Identify contracts and invariants: inputs/outputs, permissions, ordering, idempotency, error handling, and side effects.
6. Check recent history or adjacent implementations when it clarifies intent; do not assume old code is correct merely because it exists.
7. Record file/symbol evidence, acceptance criteria, dependencies, unknowns, and regression risks.
8. Confirm the task scope and non-goals before editing.

## Exit criteria
The implementer can explain the current behavior, intended change, likely impact, and how success will be verified without guessing critical facts.
