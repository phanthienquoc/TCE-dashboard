# TCE Dashboard — Copilot Repository Instructions

## Mission
Work as a repository-aware engineering agent. Understand the current implementation and documented constraints before changing code. Prefer the smallest safe, testable change over broad refactors.

## Mandatory Git workflow
- Never implement on `master`.
- Start task work on a dedicated branch based on the latest `master`, using `feat/<task>` or `fix/<task>`.
- Keep the final history suitable for one squash commit; open a PR to `master`.
- Do not merge or deploy unless explicitly within the task's authorization and repository policy.
- Never overwrite or force-update a branch without inspecting its current head.

## Repository discovery
1. Read the root README and relevant architecture/operations documentation.
2. Inspect existing code, callers, tests, package scripts, workflows, and migrations before editing.
3. Identify scope, dependencies, risk, acceptance criteria, and a verification plan.
4. Do not infer environment values, credentials, database project references, API contracts, or runtime state. Record unknowns explicitly.

## Engineering standards
- Follow existing framework, naming, module, import-alias, formatting, and testing conventions.
- Preserve compatibility unless the task explicitly permits a breaking change.
- Make changes cohesive and minimal. Do not introduce dependencies without a clear need.
- Add or update tests for behavior changes and documentation for operational or architectural changes.
- Review the final diff for unrelated changes, secrets, debug code, generated noise, and regressions.

## TCE financial/trading safety
- Treat market data, signals, portfolio calculations, decision logic, order execution, capital sizing, and risk rules as high-impact application behavior.
- Never modify live trading/execution behavior, strategy/risk rules, or order settings as collateral changes.
- Never run a production order, alter real positions, or trigger a live trade as a test.
- Do not change production database schema/data, credentials, deployment configuration, or scan schedules unless the task explicitly requires it and the target has been verified.
- Preserve the configured market-scan schedule and its continuous enablement unless the task explicitly changes it.
- A successful build or merge does not prove production runtime health. State exactly which checks were run and what they establish.

## Supabase and migrations
- Inspect current schema, migration history, callers, and environment target before database changes.
- Never print or commit secrets, access tokens, service-role keys, or private environment values.
- Do not assume a project reference from a placeholder or from an unverified URL.
- Prefer additive, reversible migrations when suitable. Detect destructive changes and data-loss risks before proceeding.
- Do not apply production migrations unless explicitly authorized and the target project is confirmed.

## Validation and failure handling
- Discover the repository's real scripts before choosing commands; do not invent package scripts.
- Run the narrowest relevant checks, then broader checks where feasible.
- For failures, preserve logs and classify whether the cause is code, test, toolchain, permission, environment, or external dependency.
- Continue independent work when safe; do not hide or bypass a failed required check.
- Never claim tests, CI, deployment, migration, or runtime verification passed unless actual results support that claim.

## Completion report
Include: summary, files changed, validation commands and outcomes, remaining risks/blockers, and PR/deployment links if they exist.
