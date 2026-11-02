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
  '[[ "$TAG" == *-"${SOURCE_HEAD_SHA:0:7}" ]]'
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

for pattern in "${required[@]}"; do
  grep -Fq -- "$pattern" "$workflow" || {
    echo "::error::TCE production release contract is missing: $pattern" >&2
    exit 1
  }
done

if grep -Eiq '(^|[[:space:]])(ssh|scp|docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+apply)([[:space:]]|$)' "$workflow"; then
  echo "::error::TCE app release workflow must publish immutable images and dispatch Platform; it must not own SSH/Compose/Kubernetes deployment." >&2
  exit 1
fi

echo "TCE production release provenance and app/platform ownership contract passed."
