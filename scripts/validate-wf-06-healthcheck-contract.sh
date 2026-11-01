#!/usr/bin/env bash
set -euo pipefail

workflow="${1:-.github/workflows/wf-06-tce-healthcheck.yml}"

ruby -e 'require "yaml"; YAML.parse_file(ARGV.fetch(0))' "$workflow"

grep -Fq "cron: '*/15 * * * *'" "$workflow"
grep -Fq "workflow_dispatch:" "$workflow"
grep -Fq "fail-fast: false" "$workflow"

for endpoint in \
  "https://tce.mrcute.space/" \
  "https://tce.mrcute.space/api/health" \
  "https://auth.mrcute.space/api/health" \
  "https://auth.mrcute.space/api/ready"; do
  grep -Fq "$endpoint" "$workflow" || {
    echo "Missing public health endpoint: $endpoint" >&2
    exit 1
  }
done

grep -Fq "Check TCE containers and legacy development ports" "$workflow"
echo "WF-06 healthcheck contract validation passed."
