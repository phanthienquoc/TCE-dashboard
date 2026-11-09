#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validator="$repo_root/scripts/verify-microfe-dispatch-payload.sh"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
event_file="$tmp_dir/event.json"

sample_sha=0123456789abcdef0123456789abcdef01234567
sample_shell_digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
sample_ws_digest=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

make_valid() {
  jq -n \
    --arg sha "$sample_sha" \
    --arg shell_digest "$sample_shell_digest" \
    --arg ws_digest "$sample_ws_digest" \
    '{
      event_type: "microfe-images-published",
      client_payload: {
        app: "microfe",
        commit: $sha,
        release: ("microfe-" + $sha[0:7]),
        shell_digest: $shell_digest,
        ws_digest: $ws_digest,
        source_repository: "phanthienquoc/TCE-dashboard",
        source_run_id: "42690000001",
        source_run_attempt: "1",
        source_workflow_path: ".github/workflows/wf-08b-tce-microfe-build-publish.yml",
        source_event: "push",
        source_head_sha: $sha
      }
    }' > "$event_file"
}

expect_failure() {
  local label="$1"
  if bash "$validator" "$event_file" >/dev/null 2>&1; then
    echo "Expected MicroFE dispatch payload rejection: $label" >&2
    exit 1
  fi
}

make_valid
bash "$validator" "$event_file" >/dev/null

make_valid
jq '.event_type = "unexpected-event"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "wrong event type"

make_valid
jq '.unexpected = true' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "unexpected root key"

make_valid
jq 'del(.event_type)' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "missing root event type"

make_valid
jq 'del(.client_payload.source_run_attempt)' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "missing required payload key"

make_valid
jq '.client_payload.unexpected = "value"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "unexpected payload key"

make_valid
jq '.client_payload.app = "tce-dashboard"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "wrong application"

make_valid
jq '.client_payload.commit = "short"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "malformed source commit"

make_valid
jq '.client_payload.release = "microfe-other"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "release label not derived from source commit"

make_valid
jq '.client_payload.shell_digest = "sha256:invalid"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "invalid Shell digest"

make_valid
jq '.client_payload.ws_digest = "sha256:invalid"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "invalid WebSocket digest"

make_valid
jq '.client_payload.source_repository = "another-owner/TCE-dashboard"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "unapproved source repository"

make_valid
jq '.client_payload.source_run_id = "0"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "zero source run ID"

make_valid
jq '.client_payload.source_run_id = 42690000001' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "non-string source run ID"

make_valid
jq '.client_payload.source_run_attempt = "0"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "zero source run attempt"

make_valid
jq '.client_payload.source_workflow_path = ".github/workflows/other.yml"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "unapproved source workflow"

make_valid
jq '.client_payload.source_event = "schedule"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "unsupported source event"

make_valid
jq '.client_payload.source_head_sha = "short"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "malformed source head"

make_valid
jq '.client_payload.source_head_sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "source head and commit mismatch"

make_valid
jq '.client_payload.commit = "0123456789ABCDEF0123456789ABCDEF01234567"' "$event_file" > "$tmp_dir/invalid.json" && mv "$tmp_dir/invalid.json" "$event_file"
expect_failure "uppercase source SHA"

printf '%s\n' "MicroFE exact sender dispatch payload tests passed (1 positive, 19 negative)."
