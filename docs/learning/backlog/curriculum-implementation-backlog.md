# Learning Curriculum — Cross-Layer Implementation Backlog

> Purpose: track shared design, infrastructure, service/backend, persistence and integration prerequisites discovered while applying learning tasks to the real TCE Dashboard. This is not a claim that every item below is already a confirmed defect; items marked **NEEDS AUDIT** must be verified against current source/configuration before implementation.

Use the shared contract in [Implementation Readiness Gate](../IMPLEMENTATION_READINESS.md). Prefer one item per shared system gap and link all lessons that depend on it.

## Status legend

- **NEEDS AUDIT** — inspect source/configuration and collect evidence before deciding.
- **READY** — prerequisites and acceptance criteria are confirmed.
- **BLOCKED** — evidence shows a missing dependency; include an explicit unblock condition.
- **IN PROGRESS / VERIFIED** — use only when implementation or verification evidence exists.

## Cross-layer items

### CURR-ARCH-01 — Map learning exercises to the real TCE architecture

- **Priority:** P0
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 9–13 currently present in `docs/learning/`; link other curriculum days when their files are added/found.
- **Gap to verify:** Each lesson needs a traceable mapping from its concept to the real route/component, API/service, event/data contract, persistence, and deployment boundary where applicable.
- **Work:** Build a concise source map with paths/symbols and service ownership. Distinguish verified facts from assumptions and identify the canonical source of truth for each data flow.
- **Acceptance:** Every existing lesson names its actual entry points and affected layers, marks irrelevant layers N/A with a reason, and links shared dependencies instead of inventing example-only interfaces.
- **Verification:** Review links/paths against the current default branch and confirm referenced files/symbols exist.

### CURR-INFRA-02 — Verify infrastructure prerequisites for service-level exercises

- **Priority:** P1
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 9–13 where a lesson introduces SSR, API transport, streams, caching, or profiling.
- **Gap to verify:** Document which exercises require only browser-local work and which require backend, deployment, network, secrets/configuration, or observability changes.
- **Work:** Inspect the current workflow, container/deployment manifests and runtime configuration relevant to each exercise. Do not change live infrastructure as part of this audit.
- **Acceptance:** Every infrastructure-affecting task has an environment scope, configuration owner, health/rollback check, and an explicit statement about whether deployment was actually verified.
- **Unblock condition:** Current manifests/workflows and ownership have been inspected and evidence is attached to the task/PR.

### CURR-SVC-03 — Verify service/API/event contracts before frontend-only implementation

- **Priority:** P0
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 10 REST cancellation; Day 11 realtime/recovery; Day 12 snapshot/event merge; Day 13 performance diagnosis.
- **Gap to verify:** Confirm actual endpoint and event producers/consumers, auth scope, versioning, timeout/retry behavior, cancellation semantics, event identity/order/cursor, and recovery source before modifying clients.
- **Work:** Trace existing service handlers and frontend consumers; write down contract gaps only where source evidence demonstrates them.
- **Acceptance:** No lesson claims end-to-end behavior based only on a client hook, mock, type, or unit test. Required service changes have an identified owner and integration test path.
- **Unblock condition:** Relevant producer and consumer contracts are located and the intended behavior is agreed/documented.

### CURR-DATA-04 — Verify persistence and versioning assumptions

- **Priority:** P1
- **Status:** NEEDS AUDIT
- **Affected lessons:** Day 11–12 and any exercise requiring durable replay, snapshot/event ordering, deduplication, or cache reconciliation.
- **Gap to verify:** Establish whether required IDs, versions, timestamps, cursors and persistence guarantees exist today; do not assume database changes are necessary or safe.
- **Work:** Inspect current data models, schema/migrations, RLS, and service contracts. Record whether the exercise can use existing contracts or needs a separately planned change.
- **Acceptance:** Stale-snapshot rejection and recovery behavior have a documented source-of-truth/version rule and deterministic tests. Any schema/RLS change has its own compatibility, security and rollback review.
- **Unblock condition:** Current persistence and ordering guarantees are verified; unresolved guarantees become a specific follow-up item.

### CURR-VERIFY-05 — Add end-to-end evidence to implementation completion

- **Priority:** P0
- **Status:** READY
- **Affected lessons:** All learning lessons.
- **Work:** Apply the readiness checklist; choose verification proportional to impact: unit/component, API/contract, integration, build/CI, deployment/runtime, and performance profiling as applicable.
- **Acceptance:** Completion reports separate implemented, integrated, CI-verified, environment-verified and production-verified states; no claim exceeds the evidence.
- **Safety:** Do not use a live order, production schema mutation, or production rollout as a test fixture.

### CURR-CATALOG-06 — Reconcile curriculum file inventory

- **Priority:** P1
- **Status:** BLOCKED
- **Affected lessons:** Day 1–13 curriculum inventory.
- **Evidence:** The repository's `docs/learning/` directory on the audited branch contains Day 9, Day 10, Day 11, Day 12 and Day 13 lesson files only. The first eight day-specific Markdown files are not present in that directory listing at the time of this audit.
- **Work:** Locate the canonical Day 1–8 lesson source or restore/create those files from the authoritative curriculum before claiming all 13 lesson files have been reviewed. Do not fabricate lesson content or mark missing files reviewed.
- **Acceptance:** A checked-in index lists the canonical path for each Day 1–13 lesson and links the readiness gate; all listed files exist.
- **Unblock condition:** The canonical source for Day 1–8 is located or the owner confirms they should be created anew.

## Day-specific follow-up

- **Day 13 performance:** Continue using [Day 13 performance implementation backlog](day13-performance-profiling-implementation-backlog.md). Establish actual consumer paths and a repeatable baseline before choosing optimizations.
- **Day 9–12:** Add specific items only when source inspection demonstrates a concrete missing contract, service capability, infrastructure requirement, or test harness. Avoid speculative migrations and duplicate backlog entries.
