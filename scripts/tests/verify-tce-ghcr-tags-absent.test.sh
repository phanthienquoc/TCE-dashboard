#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
helper="$repo_root/scripts/verify-tce-ghcr-tags-absent.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$#" -eq 4 && "$1" == "buildx" && "$2" == "imagetools" && "$3" == "inspect" ]] || {
  echo "unexpected docker invocation: $*" >&2
  exit 90
}
image="$4"
printf '%s\n' "$image" >> "${MOCK_DOCKER_LOG:?}"
case "${MOCK_MODE:-absent}" in
  absent)
    echo "ERROR: unexpected status from HEAD request: 404 Not Found" >&2
    exit 1
    ;;
  existing)
    echo "Name: $image"
    exit 0
    ;;
  forbidden)
    echo "ERROR: unexpected status from HEAD request: 403 Forbidden" >&2
    exit 1
    ;;
  unauthorized)
    echo "ERROR: unexpected status from HEAD request: 401 Unauthorized" >&2
    exit 1
    ;;
  repository_not_found)
    echo "ERROR: repository not found" >&2
    exit 1
    ;;
  missing_manifest)
    echo "ERROR: no such manifest: $image" >&2
    exit 1
    ;;
  *)
    echo "unknown mock mode" >&2
    exit 91
    ;;
esac
MOCK
chmod +x "$tmp/docker"

export PATH="$tmp:$PATH"
export MOCK_DOCKER_LOG="$tmp/docker.log"
repo="phanthienquoc/tce-dashboard"
sha="0123456789abcdef0123456789abcdef01234567"
tag="prod-v1.2.3-$sha"

: > "$MOCK_DOCKER_LOG"
MOCK_MODE=absent bash "$helper" "$repo" "$tag" "$sha" > "$tmp/absent.log"
[[ "$(wc -l < "$MOCK_DOCKER_LOG")" -eq 2 ]]
grep -Fq "Both immutable TCE GHCR release tags are absent" "$tmp/absent.log"

: > "$MOCK_DOCKER_LOG"
MOCK_MODE=missing_manifest bash "$helper" "$repo" "$tag" "$sha" > "$tmp/missing-manifest.log"
[[ "$(wc -l < "$MOCK_DOCKER_LOG")" -eq 2 ]]
grep -Fq "Both immutable TCE GHCR release tags are absent" "$tmp/missing-manifest.log"

: > "$MOCK_DOCKER_LOG"
if MOCK_MODE=existing bash "$helper" "$repo" "$tag" "$sha" > "$tmp/existing.log" 2>&1; then
  echo "Existing immutable tag was incorrectly accepted." >&2
  exit 1
fi
grep -Fq "Immutable release tag already exists" "$tmp/existing.log"
[[ "$(wc -l < "$MOCK_DOCKER_LOG")" -eq 1 ]]

for mode in forbidden unauthorized repository_not_found; do
  : > "$MOCK_DOCKER_LOG"
  if MOCK_MODE="$mode" bash "$helper" "$repo" "$tag" "$sha" > "$tmp/$mode.log" 2>&1; then
    echo "$mode was incorrectly treated as an absent immutable tag." >&2
    exit 1
  fi
  grep -Fq "Unable to verify whether immutable tag is absent" "$tmp/$mode.log"
  [[ "$(wc -l < "$MOCK_DOCKER_LOG")" -eq 1 ]]
done

: > "$MOCK_DOCKER_LOG"
if MOCK_MODE=absent bash "$helper" "$repo" "prod-v1.2.3-shortsha" "$sha" > "$tmp/invalid-tag.log" 2>&1; then
  echo "Release tag without a full source SHA was incorrectly accepted." >&2
  exit 1
fi
[[ ! -s "$MOCK_DOCKER_LOG" ]]

: > "$MOCK_DOCKER_LOG"
if MOCK_MODE=absent bash "$helper" "$repo" "$tag" "short-sha" > "$tmp/invalid-sha.log" 2>&1; then
  echo "Short source SHA was incorrectly accepted." >&2
  exit 1
fi
[[ ! -s "$MOCK_DOCKER_LOG" ]]

if MOCK_MODE=absent bash "$helper" "$repo" "prod-v1.2.3-ffffffffffffffffffffffffffffffffffffffff" "$sha" > "$tmp/mismatched-sha.log" 2>&1; then
  echo "Release tag bound to another source SHA was incorrectly accepted." >&2
  exit 1
fi
[[ ! -s "$MOCK_DOCKER_LOG" ]]

echo "TCE immutable GHCR tag preflight tests passed."
