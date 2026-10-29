---
name: validation
description: Use before reporting a task complete, creating a PR, merging, or deploying.
---

# Validation Skill

1. Discover available scripts and tool versions from the repository.
2. Map acceptance criteria to reproducible checks.
3. Run targeted tests/lint/type checks/builds supported by the repository.
4. Inspect exit codes and relevant output; distinguish failures from missing tools or unavailable credentials.
5. Check the final diff and ensure no secrets, debug code, unrelated changes, or accidental generated output remain.
6. Validate documented state independently where possible; a file's existence is not proof of runtime behavior.
7. Report each check as passed, failed, blocked, or not run.
