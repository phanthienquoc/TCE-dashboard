# TCE Dashboard

Mobile-first TCE Treasury Cash Extraction dashboard.

- Target: iOS Safari
- Data source: Supabase
- Core TCE capital: 30,000,000 VND
- DPM is separate and excluded from TCE core capital.

## Mandatory task workflow

> **STOP: Never implement code/config/deployment tasks directly on `master`.**

For every task that changes repository code, configuration, infrastructure, workflows, or deployment:

1. Start from the latest `master`.
2. Create a dedicated task branch before making any changes.
3. Implement and test the complete task on that branch.
4. Review the final diff and remove temporary/debug changes.
5. Keep the task history clean; squash task work into **one clean commit** before merging.
6. Open a PR from the task branch into `master`.
7. Merge the PR using **Squash and merge**.
8. Verify the resulting `master` commit and CI/deployment status.
9. Delete the task branch after the merge when it is no longer needed.

### Required Git flow

```text
master
  │
  └──> feat/<task-name> or fix/<task-name>
             │
             ├── implement
             ├── test
             └── review
                    │
                    ▼
               1 clean commit
                    │
                    ▼
                  PR
                    │
                    ▼
          Squash and merge → master
                    │
                    ▼
               CI / Deploy
```

### Hard rules for automated coding work

- **Do not call repository write operations against `master` while implementing a task.**
- All file changes must target the dedicated task branch.
- Do not push intermediate commits to `master`.
- Do not merge a task with multiple noisy/intermediate commits when they can be squashed.
- Before completing a task, confirm the PR is merged with the squash result on `master`.
- If a task requires multiple implementation commits, that is fine on the task branch; `master` must receive the clean squashed result only.

This workflow is mandatory for TCE repository tasks unless the user explicitly requests a different Git workflow.
