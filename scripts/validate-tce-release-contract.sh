#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
cd "$ROOT"

workflow=".github/workflows/wf-03-tce-production-deploy.yml"
[[ -f "$workflow" ]] || { echo "Missing TCE production release workflow: $workflow" >&2; exit 1; }

required=(
  "workflow_dispatch:"
  'if [[ "$GITHUB_REF" != "refs/heads/master" ]]'
  "runs-on: ubuntu-24.04-arm"
  'SOURCE_RUN_ID="$GITHUB_RUN_ID"'
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
  '--arg source_workflow_path "$SOURCE_WORKFLOW_PATH"'
  '--arg source_event "$SOURCE_EVENT"'
  '--arg source_head_sha "$SOURCE_HEAD_SHA"'
  'event_type:"tce-release-requested"'
  'client_payload.source_run_id'
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
