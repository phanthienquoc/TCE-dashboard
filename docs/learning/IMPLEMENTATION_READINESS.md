# Learning Implementation Readiness Gate

This is the shared execution contract for every learning task applied to TCE Dashboard. A lesson is not considered implemented merely because its Markdown, example snippet, mock, interface, or tests have been added. The goal is to improve or verify the real product safely.

## 1. Inspect the real system before coding

Trace the relevant behavior from entry point to runtime outcome. Use the repository's actual source and deployment configuration; do not infer missing contracts from examples.

- **System design:** module/service ownership, data flow, dependencies, sequence and failure paths, source of truth, compatibility constraints.
- **Infrastructure and delivery:** Docker/build configuration, CI workflow, K3s/VPS deployment, namespace/service/network routing, resource limits, configuration/secrets references, observability and rollback. Inspect only the layers affected by the task.
- **Services and backend:** real API/worker/scheduler/stream handlers, request and event contracts, validation, authentication/authorization, timeout, retry, idempotency, cancellation, and error semantics.
- **Database and persistence:** current schema/migrations, indexes, RLS/permissions, transaction and consistency behavior, identifiers/versioning/cursors, and backward compatibility. Do not add migrations just because an example uses a different shape.
- **Frontend:** actual route/component, state owner/store selectors, API client, loading/error/empty/stale states, accessibility and user-visible behavior.
- **Integration and operations:** end-to-end path across the relevant layers, auth/SSO boundary, environment configuration, logs/metrics, recovery, and failure behavior.

Record the concrete file paths, symbols, endpoints, deployment objects, and contracts inspected in the PR or task notes. Mark an item **unknown** when it has not been verified; do not present an assumption as a repository fact.

## 2. Make a readiness decision

- **READY:** required design, contracts, ownership, environment and safe verification path are understood. Implement the real runtime behavior in the owning layer, then test and verify it.
- **PARTIALLY READY:** implement only the independent, safe subset with established contracts. Create backlog items for the remaining dependencies and state which behavior is not yet end-to-end complete.
- **BLOCKED:** a required design decision, service, infrastructure capability, data contract, access boundary, or safety guarantee is missing. Do not invent it to make the exercise appear complete. Create or update a backlog item with evidence and an unblock condition.

For changes spanning multiple layers, identify the owner and deliverable of each layer before implementation. Do not build a frontend-only substitute when the requirement needs a backend service, persistence, deployment, or integration to work.

## 3. Required implementation and evidence

Every implementation task must provide, as applicable:

1. **Baseline and scope:** current behavior, target behavior, affected layers, and explicit non-goals.
2. **Design:** data/control flow, contracts, ownership, failure/recovery paths, and compatibility.
3. **Real code:** changes in the actual owning source/configuration, not tests or docs alone.
4. **Verification:** relevant unit/component/integration/contract tests; build/type/lint checks; deterministic replay or manual steps where automated verification is not possible.
5. **Operational verification:** deployment/configuration checks and logs/metrics when infrastructure or services are involved. Never claim production verification if only local or CI verification was performed.
6. **Correctness and safety:** auth scope, data ordering/freshness, idempotency, persistence, and user-visible states preserved as applicable.
7. **Evidence:** exact commands/results, links to CI/PR, before/after measurements for performance work, and any unresolved failures.

A passing test suite is evidence for the tested assertions, not proof that a feature is integrated or deployed. Label the state accurately: **implemented**, **integrated**, **CI-verified**, **environment-verified**, or **production-verified**.

## 4. Backlog requirements

When a prerequisite is missing, create/update a Markdown backlog item containing:

- stable ID, priority, status, and affected learning day(s);
- evidence and exact missing source/contract/design/infra/service capability;
- proposed solution and alternatives/trade-offs where a decision is needed;
- dependencies and implementation order;
- acceptance criteria that can be objectively verified;
- test/verification method, operational risks, migration/compatibility plan, and rollback where applicable;
- explicit unblock condition and the next safe independent task.

Prefer one canonical backlog item for a shared system gap and link all relevant lessons to it; avoid duplicate tasks for the same missing service or contract.

## 5. TCE safety boundaries

- Do not change production database schema, RLS, auth/SSO, secrets, trading strategy, market-scan schedules, live order execution, or deployment state merely to finish a learning exercise.
- For sensitive or production-impacting changes, inspect current ownership, configuration, tests and rollback first; use the repository's required review/CI/deployment process.
- Preserve domain-event correctness, ordering, deduplication, replay/reconciliation and auditability. Presentation coalescing must not discard events needed by risk, positions, execution, or reconciliation.
- Keep changes on a dedicated branch, never directly on `main`/`master`. Do not bypass branch protection or claim a merge/deployment that did not occur.

## 6. Completion checklist

- [ ] Real source and relevant architecture/configuration were inspected.
- [ ] System design, infrastructure, service/backend, database, frontend and integration impacts were assessed; irrelevant layers are explicitly marked N/A with a reason.
- [ ] Readiness state is recorded as READY / PARTIALLY READY / BLOCKED.
- [ ] Required runtime behavior is implemented in the actual owning layer, or missing work is tracked in backlog.
- [ ] Tests and checks cover behavior and important failure paths.
- [ ] Integration/deployment claims match the evidence actually obtained.
- [ ] Documentation and backlog reflect current implementation status and remaining gaps.
