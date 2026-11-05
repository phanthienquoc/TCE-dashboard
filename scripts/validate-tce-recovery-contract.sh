#!/usr/bin/env bash
set -euo pipefail

wf06=".github/workflows/wf-06-tce-healthcheck.yml"
wf12=".github/workflows/wf-12-tce-healthcheck-schedule-watchdog.yml"
wf13=".github/workflows/wf-13-tce-healthcheck-recovery.yml"

for file in "$wf06" "$wf12" "$wf13"; do
  [[ -f "$file" ]] || { echo "::error::Missing recovery workflow: $file" >&2; exit 1; }
done

ruby -e 'require "yaml"; ARGV.each { |file| YAML.parse_stream(File.read(file)); puts "Valid YAML: #{file}" }' "$wf06" "$wf12" "$wf13"

require_text() {
  local file="$1"
  local expected="$2"
  grep -Fq -- "$expected" "$file" || {
    echo "::error::$file is missing recovery contract: $expected" >&2
    exit 1
  }
}

# Preserve the existing native schedules and native-failure recovery path.
require_text "$wf06" "cron: '*/15 * * * *'"
require_text "$wf12" "cron: '7,22,37,52 * * * *'"
require_text "$wf13" "github.event.workflow_run.event == 'schedule'"
require_text "$wf13" "github.event.workflow_run.workflow_id == 339198323"
require_text "$wf13" "github.event.workflow_run.workflow_id == 403352324"

# A successful native WF-07 heartbeat must request the single WF-13 authority
# when WF-12 proves that native WF-06 schedule delivery is stale.
require_text "$wf12" "dispatch-stale-wf06-recovery:"
require_text "$wf12" "github.event.workflow_run.workflow_id == 341818078"
require_text "$wf12" "needs.verify.result == 'failure'"
require_text "$wf12" "Inspect latest scheduled WF-06 run"
require_text "$wf12" "Verify WF-06 workflow is enabled"
require_text "$wf12" "actions: write"
require_text "$wf12" "wf-13-tce-healthcheck-recovery.yml"
require_text "$wf12" 'source_run_id=$GITHUB_RUN_ID'
require_text "$wf12" "event=workflow_dispatch"

# WF-13 accepts the request only when the referenced run is a failed WF-12
# workflow_run on master; it remains the only dispatcher of the WF-06 fallback.
require_text "$wf13" "workflow_dispatch:"
require_text "$wf13" "source_run_id:"
require_text "$wf13" '[[ "$source_event" == "workflow_run" ]]'
require_text "$wf13" '[[ "$source_conclusion" == "failure" ]]'
require_text "$wf13" '[[ "$source_workflow_id" == "403352324" ]]'
require_text "$wf13" '[[ "$source_attempt" == "1" && "$source_branch" == "master" && "$source_conclusion" == "failure" ]]'
require_text "$wf13" 'source_mode="watchdog-detected-stale-wf06"'
require_text "$wf13" 'gh workflow run wf-06-tce-healthcheck.yml'
require_text "$wf13" 'Recent WF-06 fallback #'
require_text "$wf13" 'This workflow_dispatch fallback does not satisfy native schedule freshness.'

if grep -Eiq '(^|[[:space:]])(ssh|scp|docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+apply)([[:space:]]|$)' "$wf12" "$wf13"; then
  echo "::error::TCE healthcheck/recovery workflows must remain read-only and must not own production deployment." >&2
  exit 1
fi

echo "TCE native schedule, stale-WF-06 fallback, source correlation, and single-dispatcher contracts passed."
