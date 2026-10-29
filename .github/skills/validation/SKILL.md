---
name: validation
description: Use before reporting a task complete or proposing merge/deployment.
---

# Validation Skill

## Procedure
1. Discover scripts, versions, and workflow expectations from package manifests, Nx configuration, and existing CI files.
2. Map each acceptance criterion to one or more reproducible checks.
3. Run the narrowest relevant checks first, followed by broader lint/typecheck/test/build checks when practical.
4. Capture actual exit status and meaningful output; verify that test discovery found the intended tests.
5. Classify each check as PASS, FAIL, BLOCKED, or NOT RUN. Explain missing tools, credentials, or external dependencies.
6. Inspect the final diff and changed-file list for unrelated changes, secrets, debug code, and accidental generated artifacts.
7. For database/deployment tasks, separately verify artifact creation, remote application, rollout, and runtime health.
8. Report limitations honestly and do not infer a passing result from partial logs or a green unrelated job.

## Acceptance
A task is validated only to the extent that its acceptance criteria have corresponding evidence. A successful build alone is not proof of correctness or production health.
