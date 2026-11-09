#!/usr/bin/env bash
set -euo pipefail

EVENT_FILE="${1:-${GITHUB_EVENT_PATH:-}}"

fail() {
  echo "::error::$*" >&2
  exit 1
}

[[ -n "$EVENT_FILE" && -f "$EVENT_FILE" ]] || fail "MicroFE sender dispatch JSON is unavailable."
command -v jq >/dev/null 2>&1 || fail "jq is required to validate the MicroFE dispatch payload."

jq -e '
  . as $event
  | ($event.client_payload // null) as $payload
  | ($event | keys == ["client_payload", "event_type"])
    and ($event.event_type == "microfe-images-published")
    and ($payload | type == "object")
    and ($payload | keys == [
      "app",
      "commit",
      "release",
      "shell_digest",
      "source_event",
      "source_head_sha",
      "source_repository",
      "source_run_attempt",
      "source_run_id",
      "source_workflow_path",
      "ws_digest"
    ])
    and ($payload.app | type == "string" and . == "microfe")
    and ($payload.commit | type == "string" and test("^[0-9a-f]{40}$"))
    and ($payload.release | type == "string" and . == ("microfe-" + $payload.commit[0:7]))
    and ($payload.shell_digest | type == "string" and test("^sha256:[0-9a-f]{64}$"))
    and ($payload.ws_digest | type == "string" and test("^sha256:[0-9a-f]{64}$"))
    and ($payload.source_event | type == "string" and (. == "push" or . == "workflow_dispatch"))
    and ($payload.source_head_sha | type == "string" and test("^[0-9a-f]{40}$"))
    and ($payload.source_head_sha == $payload.commit)
    and ($payload.source_repository | type == "string" and . == "phanthienquoc/TCE-dashboard")
    and ($payload.source_run_attempt | type == "string" and test("^[1-9][0-9]*$"))
    and ($payload.source_run_id | type == "string" and test("^[1-9][0-9]*$"))
    and ($payload.source_workflow_path | type == "string" and . == ".github/workflows/wf-08b-tce-microfe-build-publish.yml")
' "$EVENT_FILE" >/dev/null || fail "MicroFE sender JSON does not match the exact approved dispatch envelope and client_payload schema."

echo "Verified exact MicroFE sender dispatch envelope, payload schema and source provenance."
