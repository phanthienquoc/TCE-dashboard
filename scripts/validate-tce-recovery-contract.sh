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

# Preserve the existing schedules and native schedule-failure recovery.
require_text "$wf06" "cron: '*/15 * * * *'"
require_text "$wf12" "cron: '7,22,37,52 * * * *'"
require_text "$wf12" "actions: read"
require_text "$wf13" "github.event.workflow_run.event == 'schedule'"
require_text "$wf13" "github.event.workflow_run.workflow_id == 339198323"
require_text "$wf13" "github.event.workflow_run.workflow_id == 403352324"

# WF-12 remains read-only; WF-13 is the only workflow allowed to dispatch WF-06.
if grep -Eq '^  actions: write$|^      actions: write$' "$wf12"; then
  echo "::error::WF-12 must remain read-only; Actions write permission is forbidden." >&2
  exit 1
fi
require_text "$wf13" "github.event.workflow_run.event == 'workflow_run'"
require_text "$wf13" '403352324:workflow_run)'
require_text "$wf13" 'Verify WF-06 schedule delivery'
require_text "$wf13" 'Verify WF-06 workflow is enabled'
require_text "$wf13" 'Inspect latest scheduled WF-06 run'
require_text "$wf13" 'source_mode="watchdog-detected-stale-wf06"'
require_text "$wf13" 'gh workflow run wf-06-tce-healthcheck.yml'
require_text "$wf13" 'Recent WF-06 fallback #'
require_text "$wf13" 'This workflow_dispatch fallback does not satisfy native schedule freshness.'

if grep -Eiq '(^|[[:space:]])(ssh|scp|docker[[:space:]]+compose|docker-compose|kubectl[[:space:]]+apply)([[:space:]]|$)' "$wf12" "$wf13"; then
  echo "::error::TCE healthcheck/recovery workflows must remain read-only and must not own production deployment." >&2
  exit 1
fi

echo "TCE native schedule, stale-WF-06 fallback, source correlation, and single-dispatcher contracts passed."
