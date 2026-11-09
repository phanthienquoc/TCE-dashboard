#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "::error::$*" >&2
  exit 1
}

expected_repository="phanthienquoc/TCE-dashboard"
expected_workflow_ref="${expected_repository}/.github/workflows/wf-03-tce-production-deploy.yml@refs/heads/master"

[[ "${GITHUB_REPOSITORY:-}" == "$expected_repository" ]] || fail "TCE production release must run in $expected_repository."
[[ "${GITHUB_WORKFLOW_REF:-}" == "$expected_workflow_ref" ]] || fail "TCE production release must originate from the approved WF-03 on master."
[[ "${GITHUB_REF:-}" == "refs/heads/master" ]] || fail "TCE production release must run from refs/heads/master."
[[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]] || fail "TCE production release must originate from workflow_dispatch."
[[ "${GITHUB_RUN_ID:-}" =~ ^[1-9][0-9]*$ ]] || fail "TCE source Actions run ID must be a positive integer."
[[ "${GITHUB_RUN_ATTEMPT:-}" =~ ^[1-9][0-9]*$ ]] || fail "TCE source Actions run attempt must be a positive integer."
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || fail "TCE source commit must be a full 40-character SHA."

echo "Verified TCE production release source context before build or publication."
