#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validator="$ROOT/scripts/verify-tce-release-source-context.sh"
[[ -f "$validator" ]] || { echo "Missing TCE release source-context validator." >&2; exit 1; }

sample_sha=0123456789abcdef0123456789abcdef01234567
expected_repo=phanthienquoc/TCE-dashboard
expected_workflow_ref="$expected_repo/.github/workflows/wf-03-tce-production-deploy.yml@refs/heads/master"

run_validator() {
  env \
    GITHUB_REPOSITORY="$expected_repo" \
    GITHUB_WORKFLOW_REF="$expected_workflow_ref" \
    GITHUB_REF="refs/heads/master" \
    GITHUB_EVENT_NAME="workflow_dispatch" \
    GITHUB_RUN_ID="42670000001" \
    GITHUB_RUN_ATTEMPT="1" \
    GITHUB_SHA="$sample_sha" \
    "$@" bash "$validator"
}

expect_failure() {
  local label="$1"
  shift
  if run_validator "$@" >/dev/null 2>&1; then
    echo "Expected TCE release source-context rejection: $label" >&2
    exit 1
  fi
}

run_validator

expect_failure "wrong repository" GITHUB_REPOSITORY=phanthienquoc/other
expect_failure "wrong workflow path" GITHUB_WORKFLOW_REF="$expected_repo/.github/workflows/other.yml@refs/heads/master"
expect_failure "non-master ref" GITHUB_REF=refs/heads/release
expect_failure "non-manual event" GITHUB_EVENT_NAME=push
expect_failure "zero run ID" GITHUB_RUN_ID=0
expect_failure "zero run attempt" GITHUB_RUN_ATTEMPT=0
expect_failure "short source SHA" GITHUB_SHA=abc123
expect_failure "missing run ID" GITHUB_RUN_ID=

printf '%s\\n' "TCE pre-publication source-context tests passed (1 positive, 8 negative cases)."
