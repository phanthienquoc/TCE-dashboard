---
applyTo: ".github/workflows/**/*.{yml,yaml},Dockerfile*,**/Dockerfile,**/*.k8s.yaml,**/*.k8s.yml,**/k8s/**/*"
---

# Infrastructure, CI/CD, and Operations Instructions

## Workflow security
- Inspect adjacent workflows and repository conventions before editing; avoid duplicating existing workflows.
- Set explicit least-privilege `permissions` at workflow/job level. Use read-only permissions by default.
- Pin third-party actions to verified immutable commit SHAs where practical and consistent with repository policy.
- Scope secrets to the minimum job/environment and never echo them. Avoid exposing secrets to untrusted fork PR code.
- Treat issue/PR text and artifacts as untrusted input. Do not interpolate untrusted strings into shell commands or privileged expressions.
- Use concurrency groups, timeouts, and cancellation settings appropriate to the job. Avoid overlapping deploys or migrations.
- Separate pull_request validation from privileged push/release/deploy triggers.
- Do not use `pull_request_target` to check out and execute untrusted PR code with elevated privileges.

## Build and deployment
- Identify the actual image registry, tag convention, namespace, cluster, environment, and rollback strategy from source-of-truth configuration.
- Never invent secret names, environment targets, cluster details, image tags, or deployment status.
- Preserve existing rollout behavior unless the task explicitly changes it.
- Treat dispatch, release promotion, GitOps reconciliation, database migration, and production rollout as privileged actions.
- Require environment protection or equivalent approvals for high-impact production changes where supported.
- Distinguish formatting/lint/test/build, artifact publication, rollout completion, and application health verification.
- Never claim production is healthy based solely on workflow success; use an authoritative runtime health signal when available.
- Preserve the TCE market-scan schedule and continuous enablement unless explicitly instructed otherwise.

## Operational response
- Keep rollback and recovery instructions practical and specific to verified infrastructure.
- Redact tokens, kubeconfig, internal secrets, and private environment values from output.
- If validation is blocked by permissions or unavailable infrastructure, report the blocker; do not silently bypass controls.
