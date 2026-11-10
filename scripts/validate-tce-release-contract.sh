#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
cd "$ROOT"

workflow=".github/workflows/wf-03-tce-production-deploy.yml"
[[ -f "$workflow" ]] || { echo "Missing TCE production release workflow: $workflow" >&2; exit 1; }

microfe_workflow=".github/workflows/wf-08b-tce-microfe-build-publish.yml"
[[ -f "$microfe_workflow" ]] || { echo "Missing MicroFE publisher workflow: $microfe_workflow" >&2; exit 1; }
[[ -f scripts/verify-microfe-dispatch-payload.sh ]]
[[ -f scripts/tests/verify-microfe-dispatch-payload.test.sh ]]
grep -Fq 'bash scripts/verify-microfe-dispatch-payload.sh /tmp/microfe-dispatch.json' "$microfe_workflow"
grep -Fq 'bash scripts/tests/verify-microfe-dispatch-payload.test.sh' "$microfe_workflow"
bash scripts/tests/verify-microfe-dispatch-payload.test.sh

build_verify_workflow=".github/workflows/wf-01-tce-build-verify.yml"
[[ -f "$build_verify_workflow" ]] || { echo "Missing TCE build verification workflow: $build_verify_workflow" >&2; exit 1; }
if grep -Eiq 'VPS_SSH_PRIVATE_KEY|StrictHostKeyChecking|ssh[[:space:]]+-i|docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+apply' "$build_verify_workflow"; then
  echo "::error::WF-01 must remain an app CI/build validator and must not depend on production SSH or own host/cluster deployment." >&2
  exit 1
fi

legacy_cleanup_workflow=".github/workflows/wf-04-tce-k3s-cleanup.yml"
if [[ -e "$legacy_cleanup_workflow" ]]; then
  echo "::error::Legacy WF-04 direct-SSH production cleanup must not be restored; Platform Infra owns K3s image cleanup." >&2
  exit 1
fi

staging_bootstrap_workflow=".github/workflows/wf-10-tce-k3s-bootstrap.yml"
if [[ -f "$staging_bootstrap_workflow" ]]; then
  if grep -Eiq 'MFA_ENCRYPTION_KEY_PROD|MFA_PROD|TCE_PROD_NAMESPACE|tce-prod' "$staging_bootstrap_workflow"; then
    echo "::error::TCE WF-10 may bootstrap staging only; production namespaces and runtime secrets belong to Platform Infra." >&2
    exit 1
  fi
  grep -Fq 'MFA_ENCRYPTION_KEY_STG' "$staging_bootstrap_workflow" || {
    echo "::error::TCE WF-10 must retain its staging-only MFA secret contract." >&2
    exit 1
  }
fi


# WF-09 is a manual, read-only VPS inspection plus source staging utility.
# Keep it out of production deployment authority and ensure source is confined
# to the isolated development tree. Its SSH host-key pinning remains a separate
# owner-dependent security follow-up; do not silently trust a scanned key here.
safe_setup_workflow=".github/workflows/wf-09-tce-vps-safe-setup.yml"
if [[ -f "$safe_setup_workflow" ]]; then
  if grep -Eq '^  (push|pull_request|schedule|repository_dispatch):' "$safe_setup_workflow"; then
    echo "::error::TCE WF-09 must remain manual-only; it is not a production release or scheduled deployment workflow." >&2
    exit 1
  fi
  grep -Fq '  workflow_dispatch:' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 must retain its explicit manual workflow_dispatch entry point." >&2
    exit 1
  }
  grep -Fq 'name: Inspect VPS without changing existing services' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 must retain its read-only VPS inspection step." >&2
    exit 1
  }
  grep -Fq 'name: Upload TCE source to isolated development directory' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 source upload must be clearly labeled as development-only." >&2
    exit 1
  }
  grep -Fq '/home/ubuntu/tce/development/source.tmp' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 must confine source extraction to /home/ubuntu/tce/development/source.tmp." >&2
    exit 1
  }
  grep -Fq 'tar -xzf /tmp/tce-source.tar.gz -C /home/ubuntu/tce/development/source.tmp' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 must extract its upload only into the isolated development source directory." >&2
    exit 1
  }
  if grep -Eiq 'docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+(apply|delete|scale|rollout)|systemctl[[:space:]]+(restart|stop|disable)|docker[[:space:]]+(restart|stop|rm)|rsync[[:space:]].*--delete' "$safe_setup_workflow"; then
    echo "::error::TCE WF-09 must not mutate production containers, services or Kubernetes workloads." >&2
    exit 1
  fi
  extract_count="$(grep -Fc 'tar -xzf /tmp/tce-source.tar.gz -C ' "$safe_setup_workflow" || true)"
  [[ "$extract_count" -eq 1 ]] || {
    echo "::error::TCE WF-09 must have exactly one source extraction target, under the isolated development directory." >&2
    exit 1
  }
  if grep -Eiq 'scp[[:space:]].*/home/ubuntu/tce/(staging|production)' "$safe_setup_workflow"; then
    echo "::error::TCE WF-09 must not transfer source directly into staging or production runtime directories." >&2
    exit 1
  fi
  grep -Fq 'if: always()' "$safe_setup_workflow" || {
    echo "::error::TCE WF-09 must always clean up its temporary SSH key." >&2
    exit 1
  }
fi

required=(
  'group: tce-production-release-${{ github.sha }}'
  'cancel-in-progress: false'
  'Refuse to overwrite existing immutable GHCR release tags'
  'run: bash scripts/verify-tce-ghcr-tags-absent.sh "$REPOSITORY" "$RELEASE_TAG" "$SOURCE_SHA"'
  "workflow_dispatch:"
  'if [[ "$GITHUB_REF" != "refs/heads/master" ]]'
  'run: bash scripts/verify-tce-release-source-context.sh'
  "runs-on: ubuntu-24.04-arm"
  'SOURCE_RUN_ID="$GITHUB_RUN_ID"'
  '[[ "$SOURCE_RUN_ID" =~ ^[1-9][0-9]*$ ]]'
  'SOURCE_RUN_ATTEMPT="$GITHUB_RUN_ATTEMPT"'
  '[[ "$SOURCE_RUN_ATTEMPT" =~ ^[1-9][0-9]*$ ]]'
  'SOURCE_WORKFLOW_PATH=".github/workflows/wf-03-tce-production-deploy.yml"'
  'SOURCE_EVENT="$GITHUB_EVENT_NAME"'
  'SOURCE_HEAD_SHA="$GITHUB_SHA"'
  '[[ "$SOURCE_EVENT" == "workflow_dispatch" ]]'
  '[[ "$SOURCE_HEAD_SHA" =~ ^[0-9a-f]{40}$ && "$SOURCE_HEAD_SHA" == "$GITHUB_SHA" ]]'
  '[[ "$TAG" == *-"$SOURCE_HEAD_SHA" ]]'
  'SHA="$GITHUB_SHA"'
  '[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]'
  'docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1'
  'docker buildx imagetools inspect "$image"'
  'echo "${component}_digest=$digest"'
  'WEB_DIGEST: ${{ steps.image-digests.outputs.web_digest }}'
  'SERVICE_DIGEST: ${{ steps.image-digests.outputs.service_digest }}'
  '[[ "$WEB_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]'
  '[[ "$SERVICE_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]'
  '--arg web_digest "$WEB_DIGEST"'
  '--arg service_digest "$SERVICE_DIGEST"'
  'client_payload.web_digest'
  'client_payload.service_digest'
  '--arg source_run_id "$SOURCE_RUN_ID"'
  '--arg source_run_attempt "$SOURCE_RUN_ATTEMPT"'
  '--arg source_workflow_path "$SOURCE_WORKFLOW_PATH"'
  '--arg source_event "$SOURCE_EVENT"'
  '--arg source_head_sha "$SOURCE_HEAD_SHA"'
  'event_type:"tce-release-requested"'
  'client_payload.source_run_id'
  'client_payload.source_run_attempt'
  'client_payload.source_workflow_path'
  'client_payload.source_event'
  'client_payload.source_head_sha'
  'jq -e'
  'docker push "$WEB_IMAGE"'
  'docker push "$SERVICE_IMAGE"'
  'Verify platform-infra release workflow'
)

grep -Fq 'uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1' "$workflow"
[[ "$(grep -Fc 'uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2' "$workflow")" -eq 3 ]]
grep -Fq 'uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2' "$workflow"
grep -Fq 'uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6 # v4.7.0' "$workflow"
grep -Fq 'uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1' "$workflow"
if grep -Eq '^  (push|pull_request|schedule):' "$workflow"; then echo "::error::TCE production publisher must remain manual-only." >&2; exit 1; fi

[[ -f scripts/verify-tce-ghcr-tags-absent.sh ]]
[[ -f scripts/tests/verify-tce-ghcr-tags-absent.test.sh ]]
bash scripts/tests/verify-tce-ghcr-tags-absent.test.sh
[[ -f scripts/tests/verify-tce-dispatch-payload.test.sh ]]
bash scripts/tests/verify-tce-dispatch-payload.test.sh
[[ -f scripts/tests/verify-tce-release-source-context.test.sh ]]
bash scripts/tests/verify-tce-release-source-context.test.sh

preflight_job="$(sed -n '/^  validate-release-ref:/,/^  notify-telegram-start:/p' "$workflow")"
grep -Fq 'name: Validate release source context before builds or publication' <<< "$preflight_job" || {
  echo "::error::TCE source-context validation must run in the first release gate, before notifications, builds or publication." >&2
  exit 1
}
grep -Fq 'run: bash scripts/verify-tce-release-source-context.sh' <<< "$preflight_job" || {
  echo "::error::TCE source-context validator is missing from the pre-publication release gate." >&2
  exit 1
}

for pattern in "${required[@]}"; do
  grep -Fq -- "$pattern" "$workflow" || {
    echo "::error::TCE production release contract is missing: $pattern" >&2
    exit 1
  }
done

top_level_permissions="$(sed -n '/^permissions:/,/^[^ ]/p' "$workflow")"
grep -Fq '  contents: read' <<< "$top_level_permissions"
! grep -Fq '  packages: write' <<< "$top_level_permissions"
! grep -Fq '  actions: read' <<< "$top_level_permissions"
release_job="$(sed -n '/^  platform-infra-release:/,/^  [a-z0-9-]*:/p' "$workflow")"
grep -Fq '    permissions:' <<< "$release_job"
grep -Fq '      contents: read' <<< "$release_job"
grep -Fq '      actions: read' <<< "$release_job"
grep -Fq '      packages: write' <<< "$release_job"
[[ "$(grep -Fc 'packages: write' "$workflow")" -eq 1 ]]

if grep -Eiq '(^|[[:space:]])(ssh|scp|docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+apply)([[:space:]]|$)' "$workflow"; then
  echo "::error::TCE app release workflow must publish immutable images and dispatch Platform; it must not own SSH/Compose/Kubernetes deployment." >&2
  exit 1
fi

echo "TCE production release provenance and app/platform ownership contract passed."
