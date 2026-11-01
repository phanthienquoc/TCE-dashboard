#!/usr/bin/env bash
set -euo pipefail

healthcheck_workflow="${1:-.github/workflows/wf-06-tce-healthcheck.yml}"
watchdog_workflow="${2:-.github/workflows/wf-12-tce-healthcheck-schedule-watchdog.yml}"

ruby -e 'require "yaml"; ARGV.each { |path| YAML.parse_file(path) }' "$healthcheck_workflow" "$watchdog_workflow"

grep -Fq "cron: '*/15 * * * *'" "$healthcheck_workflow"
grep -Fq "workflow_dispatch:" "$healthcheck_workflow"
grep -Fq "fail-fast: false" "$healthcheck_workflow"

for endpoint in \
  "https://tce.mrcute.space/" \
  "https://tce.mrcute.space/api/health" \
  "https://auth.mrcute.space/api/health" \
  "https://auth.mrcute.space/api/ready"; do
  grep -Fq "$endpoint" "$healthcheck_workflow" || {
    echo "Missing public health endpoint: $endpoint" >&2
    exit 1
  }
done

grep -Fq "Check TCE containers and legacy development ports" "$healthcheck_workflow"

# WF-12 is a read-only monitor for delivery of the existing WF-06 schedule.
# It must not change WF-06's cadence or acquire Actions write permission.
grep -Fq "cron: '7,22,37,52 * * * *'" "$watchdog_workflow"
grep -Fq "workflow_dispatch:" "$watchdog_workflow"
grep -Fq "workflow_run:" "$watchdog_workflow"
grep -Fq "WF-06 TCE Healthcheck" "$watchdog_workflow"
grep -Fq "WF-07 TCE 3rd-Party Integration Check" "$watchdog_workflow"
grep -Fq "github.event.workflow.path == '.github/workflows/wf-06-tce-healthcheck.yml'" "$watchdog_workflow"
grep -Fq "github.event.workflow.path == '.github/workflows/wf-07-tce-integration-check.yml'" "$watchdog_workflow"
grep -Fq "actions/workflows/wf-06-tce-healthcheck.yml" "$watchdog_workflow"
grep -Fq "event=schedule" "$watchdog_workflow"
grep -Fq 'MAX_AGE_MINUTES: "25"' "$watchdog_workflow"
grep -Fq 'MAX_QUEUE_MINUTES: "15"' "$watchdog_workflow"
# Compare run timestamps from the same GitHub Actions API clock. The runner host
# clock is not a reliable reference for freshness (observed one-hour skew).
grep -Fq 'actions/runs/${GITHUB_RUN_ID}' "$watchdog_workflow"
grep -Fq 'age_seconds=$((reference_epoch - created_epoch))' "$watchdog_workflow"
grep -Fq 'reference_epoch=' "$watchdog_workflow"
grep -Fq "run_attempt" "$watchdog_workflow"
grep -Fq "queue_measurable=false" "$watchdog_workflow"
grep -Fq "queue=not-measurable" "$watchdog_workflow"
grep -Fq "queue wait is not measurable on rerun attempt" "$watchdog_workflow"
if grep -Fq 'date -u +%s' "$watchdog_workflow"; then
  echo "WF-12 must not compare Actions API timestamps with the hosted runner wall clock." >&2
  exit 1
fi

grep -Fq "actions: read" "$watchdog_workflow"

if grep -Eq '^[[:space:]]+actions:[[:space:]]*write' "$watchdog_workflow"; then
  echo "WF-12 must remain read-only; Actions write permission is forbidden." >&2
  exit 1
fi

# WF-12 forwards scheduled activity to Platform Infra using the existing,
# least-privilege repository-dispatch token. The receiver remains the only
# GitOps/inspection authority; the heartbeat payload carries no deployment inputs.
grep -Fq "name: Notify Platform Infra — TCE schedule heartbeat" "$watchdog_workflow"
grep -Fq 'PLATFORM_INFRA_TOKEN: ${{ secrets.PLATFORM_INFRA_TOKEN }}' "$watchdog_workflow"
grep -Fq "https://api.github.com/repos/phanthienquoc/platform-infra/dispatches" "$watchdog_workflow"
grep -Fq 'event_type:"tce-schedule-heartbeat"' "$watchdog_workflow"
grep -Fq 'source_repository:$source_repository' "$watchdog_workflow"
grep -Fq 'source_event:$source_event' "$watchdog_workflow"
grep -Fq 'source_workflow_path:$source_workflow_path' "$watchdog_workflow"
grep -Fq 'source_run_id:$source_run_id' "$watchdog_workflow"
grep -Fq 'source_head_sha:$source_head_sha' "$watchdog_workflow"
grep -Fq 'heartbeat_run_id:$heartbeat_run_id' "$watchdog_workflow"
grep -Fq 'heartbeat_head_sha:$heartbeat_head_sha' "$watchdog_workflow"
grep -Fq 'http_code" == "204"' "$watchdog_workflow"
heartbeat_block="$(sed -n '/^  notify-platform-infra:/,$p' "$watchdog_workflow")"
grep -Fq "github.event_name == 'schedule'" <<< "$heartbeat_block"
grep -Fq "github.event.workflow_run.event == 'schedule'" <<< "$heartbeat_block"
grep -Fq "wf-06-tce-healthcheck.yml" <<< "$heartbeat_block"
grep -Fq "wf-07-tce-integration-check.yml" <<< "$heartbeat_block"

echo "WF-06, WF-12 schedule-delivery, and Platform Infra heartbeat contracts validated."
