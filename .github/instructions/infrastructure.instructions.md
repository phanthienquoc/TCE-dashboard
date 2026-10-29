---
applyTo: ".github/workflows/**/*.{yml,yaml},Dockerfile*,**/Dockerfile,**/*.k8s.yaml,**/*.k8s.yml,**/k8s/**/*"
---

# Infrastructure and Delivery Instructions

- Read current workflow/deployment conventions and identify all affected environments before edits.
- Pin third-party actions to immutable commit SHAs where consistent with project policy; apply least privilege to workflow permissions.
- Treat workflow dispatch, release tagging, secret access, GitOps reconciliation, migration, and production rollout as privileged operations.
- Never echo secrets, tokens, kubeconfig, or private environment values to logs.
- Preserve current production rollout behavior unless the task explicitly requires a change.
- Use concurrency controls and environment protections where appropriate; avoid overlapping destructive deployments.
- Distinguish configuration validation, image publication, deployment completion, and runtime health checks.
- Do not invent cluster names, namespaces, image tags, secret names, or environment targets.
