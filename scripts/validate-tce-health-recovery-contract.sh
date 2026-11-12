#!/usr/bin/env bash
set -euo pipefail

recovery=".github/workflows/wf-13-tce-healthcheck-recovery.yml"
health=".github/workflows/wf-06-tce-healthcheck.yml"
watchdog=".github/workflows/wf-12-tce-healthcheck-schedule-watchdog.yml"
pr_build=".github/workflows/wf-01p-tce-web-pr-build.yml"

for file in "$recovery" "$health" "$watchdog" "$pr_build"; do
  [[ -s "$file" ]] || { echo "::error::Missing workflow contract file: $file"; exit 1; }
done

grep -Fq 'TCE_MAINTENANCE_MODE: ${{ vars.TCE_MAINTENANCE_MODE }}' "$recovery"
grep -Fq 'case "${TCE_MAINTENANCE_MODE,,}" in' "$recovery"
grep -Fq 'true|1|yes)' "$recovery"
grep -Fq '            "")' "$recovery"
grep -Fq 'false|0|no)' "$recovery"
grep -Fq 'TCE_MAINTENANCE_MODE is unset; treating this run as non-maintenance' "$recovery"
if grep -Fq '""|false|0|no)' "$recovery"; then
  echo "::error::An unset maintenance flag must not be silently conflated with an explicit false value."
  exit 1
fi
guard_count="$(grep -Fc "if: steps.maintenance.outputs.enabled != 'true'" "$recovery")"
[[ "$guard_count" == "2" ]] || {
  echo "::error::Both recovery source validation and fallback dispatch must be gated by explicit maintenance mode (found $guard_count guards)."
  exit 1
}
grep -Fq 'gh workflow run wf-06-tce-healthcheck.yml' "$recovery"

expected_200_count="$(grep -Fc 'expected_status: "200"' "$health")"
[[ "$expected_200_count" == "4" ]] || {
  echo "::error::WF-06 must retain all four strict HTTP 200 endpoint contracts (found $expected_200_count)."
  exit 1
}
grep -Fq "cron: '*/15 * * * *'" "$health"
grep -Fq "cron: '7,22,37,52 * * * *'" "$watchdog"
grep -Fq "scripts/validate-tce-health-recovery-contract.sh" "$pr_build"

ruby -e 'require "yaml"; ARGV.each { |file| YAML.parse_file(file); puts "YAML OK: #{file}" }' "$recovery" "$health" "$watchdog" "$pr_build"

echo "PASS: explicit maintenance suppresses only WF-06 fallback; an unset flag is visibly warned and remains non-maintenance; strict HTTP 200 health and both native schedules are preserved."
