---
name: repository-analysis
description: Use when starting an unfamiliar TCE task or when dependencies and current behavior need to be understood before implementation.
---

# Repository Analysis Skill

1. Read `.github/copilot-instructions.md` and the nearest applicable path instructions.
2. Read root README and the most relevant architecture/operations docs.
3. Search for the feature entrypoint, public API, state/data model, callers, tests, and configuration.
4. Follow the path from user-visible entrypoint through service/database/infrastructure as applicable.
5. Identify contracts, invariants, side effects, and rollback considerations.
6. Write evidence-backed acceptance criteria and list unknowns rather than guessing.
7. Before editing, confirm the intended scope excludes unrelated behavior.
