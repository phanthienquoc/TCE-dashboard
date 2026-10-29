# GitHub Copilot Agentic Roadmap — TCE Dashboard

## Goal

Enable repository-aware planning, implementation, validation, and independent review while preserving financial correctness, data integrity, security, and production stability.

## Phase 0 — Foundation

- [x] Repository-wide Copilot instructions and task lifecycle.
- [x] Path-specific frontend, backend, database, testing, and infrastructure guidance.
- [x] Planner, Developer, and Reviewer role definitions.
- [x] Reusable repository-analysis, implementation, validation, and database-migration skills.
- [x] Explicit safety boundaries and an incremental rollout plan.

## Phase 1 — Compatibility and low-risk proof

- [ ] Validate agent and skill frontmatter against the Copilot features available to this repository's users.
- [ ] Confirm instructions are picked up in the supported GitHub Copilot surfaces.
- [ ] Select one documentation-only or isolated non-production task.
- [ ] Run Planner → Developer → Validation → Reviewer and retain the evidence.
- [ ] Record false positives, missed constraints, and instruction gaps; update files based on evidence.
- [ ] Confirm the standard branch, PR, and squash-merge flow remains intact.

## Phase 2 — Safe PR assistance

- [ ] Audit existing workflows before adding any new workflow; reuse existing CI where possible.
- [ ] Start with advisory issue triage, failure summaries, or review assistance.
- [ ] Use least-privilege permissions, pinned actions where practical, timeouts, concurrency controls, and explicit triggers.
- [ ] Treat issue/PR text and artifacts as untrusted; do not pass arbitrary content into privileged shell commands.
- [ ] Keep privileged jobs isolated from untrusted fork PR code.
- [ ] Ensure no automatic production writes, database migrations, live trading, or deployment are introduced by this phase.

## Phase 3 — Controlled implementation automation

- [ ] Define allowed task categories, protected paths, and explicit stop conditions.
- [ ] Require branch isolation, tests, diff review, and clear PR summaries.
- [ ] Prevent agents from changing their own guardrails or bypassing required checks as part of ordinary tasks.
- [ ] Make failures observable and distinguish code failures from permissions/environment/external dependency failures.
- [ ] Track task success, review findings, escaped defects, and time saved.

## Phase 4 — Controlled delivery

- [ ] Document branch protection, required checks, reviewer requirements, and squash-merge policy.
- [ ] Verify protected environments and approval requirements for production operations.
- [ ] Define deployment target identity, rollback/recovery, and authoritative runtime health checks.
- [ ] Keep build, artifact publication, deployment, and runtime verification as separate statuses.
- [ ] Only automate high-impact actions after explicit authorization, target verification, and tested recovery procedures.

## Definition of done for agentic tasks

- Acceptance criteria are explicit and mapped to evidence.
- Changes are scoped, reviewed, and tested with real repository commands.
- Risks, failed/blocked checks, and remaining uncertainty are disclosed.
- No secrets or unrelated files are introduced.
- Delivery status is accurate; merge/deploy/runtime claims are independently supported.

## Non-goals for the foundation

- No application behavior or trading strategy changes.
- No Supabase schema/data mutation.
- No credential or permission changes.
- No live orders, production deployment, or market-scan schedule changes.
- No claim that CI, tests, Copilot compatibility, or production runtime have passed without evidence.
