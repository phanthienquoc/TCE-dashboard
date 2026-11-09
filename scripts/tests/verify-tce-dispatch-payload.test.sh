#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/wf-03-tce-production-deploy.yml"
[[ -f "$WORKFLOW" ]] || { echo "Missing TCE production workflow." >&2; exit 1; }

filter="$(python3 - "$WORKFLOW" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
payload_start = text.index('payload="$(jq -cn')
jq_start = text.index("          jq -e \\", payload_start)
filter_start = text.index("'", jq_start) + 1
filter_end = text.index("' \\", filter_start)
print(text[filter_start:filter_end])
PY
)"
[[ -n "$filter" ]] || { echo "Unable to extract the exact TCE publisher jq filter." >&2; exit 1; }

sample_sha=0123456789abcdef0123456789abcdef01234567
sample_run_id=42670000001
sample_run_attempt=1
sample_release="prod-v1.2.3-$sample_sha"
sample_web_digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
sample_service_digest=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

make_valid() {
  jq -n \
    --arg sha "$sample_sha" \
    --arg run_id "$sample_run_id" \
    --arg run_attempt "$sample_run_attempt" \
    --arg release "$sample_release" \
    --arg web_digest "$sample_web_digest" \
    --arg service_digest "$sample_service_digest" \
    '{
      event_type: "tce-release-requested",
      client_payload: {
        app: "tce-dashboard",
        release: $release,
        web_digest: $web_digest,
        service_digest: $service_digest,
        source_run_id: $run_id,
        source_run_attempt: $run_attempt,
        source_workflow_path: ".github/workflows/wf-03-tce-production-deploy.yml",
        source_event: "workflow_dispatch",
        source_head_sha: $sha
      }
    }'
}

run_filter() {
  local payload="$1"
  jq -e \
    --arg app "tce-dashboard" \
    --arg release "$sample_release" \
    --arg web_digest "$sample_web_digest" \
    --arg service_digest "$sample_service_digest" \
    --arg source_run_id "$sample_run_id" \
    --arg source_run_attempt "$sample_run_attempt" \
    --arg source_workflow_path ".github/workflows/wf-03-tce-production-deploy.yml" \
    --arg source_event "workflow_dispatch" \
    --arg source_head_sha "$sample_sha" \
    "$filter" <<< "$payload" >/dev/null
}

expect_failure() {
  local label="$1"
  local payload="$2"
  if run_filter "$payload" >/dev/null 2>&1; then
    echo "Expected TCE publisher payload filter rejection: $label" >&2
    exit 1
  fi
}

valid_payload="$(make_valid)"
run_filter "$valid_payload"

expect_failure "unexpected root key" "$(jq '.extra = true' <<< "$valid_payload")"
expect_failure "missing event type" "$(jq 'del(.event_type)' <<< "$valid_payload")"
expect_failure "wrong event type" "$(jq '.event_type = "wrong-event"' <<< "$valid_payload")"
expect_failure "missing client payload key" "$(jq 'del(.client_payload.source_run_attempt)' <<< "$valid_payload")"
expect_failure "unexpected client payload key" "$(jq '.client_payload.extra = "value"' <<< "$valid_payload")"
expect_failure "non-object client payload" "$(jq '.client_payload = []' <<< "$valid_payload")"
expect_failure "wrong application" "$(jq '.client_payload.app = "stockdividend"' <<< "$valid_payload")"
expect_failure "malformed release tag" "$(jq '.client_payload.release = "prod-v1.2.3-short"' <<< "$valid_payload")"
expect_failure "release tag not bound to source SHA" "$(jq '.client_payload.release = "prod-v1.2.3-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' <<< "$valid_payload")"
expect_failure "invalid web digest" "$(jq '.client_payload.web_digest = "sha256:bad"' <<< "$valid_payload")"
expect_failure "invalid service digest" "$(jq '.client_payload.service_digest = "sha256:bad"' <<< "$valid_payload")"
expect_failure "zero source run ID" "$(jq '.client_payload.source_run_id = "0"' <<< "$valid_payload")"
expect_failure "numeric source run ID" "$(jq '.client_payload.source_run_id = 42670000001' <<< "$valid_payload")"
expect_failure "zero source run attempt" "$(jq '.client_payload.source_run_attempt = "0"' <<< "$valid_payload")"
expect_failure "unapproved source workflow" "$(jq '.client_payload.source_workflow_path = ".github/workflows/other.yml"' <<< "$valid_payload")"
expect_failure "non-manual publisher event" "$(jq '.client_payload.source_event = "push"' <<< "$valid_payload")"
expect_failure "invalid source head SHA" "$(jq '.client_payload.source_head_sha = "short"' <<< "$valid_payload")"

printf '%s\n' "TCE publisher exact dispatch payload filter tests passed."
