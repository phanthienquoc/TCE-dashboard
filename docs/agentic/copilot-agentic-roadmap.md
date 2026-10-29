# Copilot Agentic Roadmap — TCE Dashboard

## Goal

Establish a repository-aware agent workflow that can analyze, implement, validate, and review bounded tasks while preserving TCE's financial, database, and production invariants.

## Phase 0 — Foundation (this change)

- [x] Repository-wide Copilot instructions
- [x] Path-specific instructions for frontend, backend, database, testing, and infrastructure
- [x] Planner, developer, and reviewer role definitions
- [x] Reusable skills for analysis, implementation, validation, and migrations
- [x] Agentic foundation and operating boundaries documented

## Phase 1 — Prove in a low-risk task

- [ ] Choose one documentation-only or isolated non-production task.
- [ ] Have Planner produce an evidence-backed plan.
- [ ] Have Developer implement on a dedicated branch.
- [ ] Run real repository checks and record results.
- [ ] Have Reviewer independently assess the diff.
- [ ] Capture gaps in instructions before expanding automation.

## Phase 2 — PR automation

- [ ] Add or adapt workflows only after auditing existing workflow conventions.
- [ ] Limit permissions to the minimum required.
- [ ] Use explicit concurrency, timeouts, and fail-closed behavior for privileged operations.
- [ ] Start with informational triage/review, not automatic production writes.
- [ ] Ensure untrusted issue/PR text cannot directly grant permissions or execute arbitrary commands.

## Phase 3 — Controlled delivery

- [ ] Define branch protection, required checks, reviewer policy, and squash-merge policy.
- [ ] Define environment protections for deployment and database migrations.
- [ ] Automate deployment only where the target, rollback, and runtime verification are explicit.
- [ ] Separate image/build success from production health confirmation.

## Acceptance criteria

- Copilot has clear repository-level constraints and scoped instructions.
- Role definitions separate planning, implementation, and review responsibilities.
- Reusable skills define repeatable analysis and validation procedures.
- No workflow with production-writing capability is introduced in this foundation change.
- Documentation states that these files configure agent guidance, not permissions or autonomous execution by themselves.

## Non-goals

- No application code changes.
- No Supabase schema or data changes.
- No secret/credential changes.
- No live trading or order execution.
- No production deployment or market-scan schedule changes.
- No claim that CI, tests, runtime, or agent capabilities have been verified by this documentation-only change.
