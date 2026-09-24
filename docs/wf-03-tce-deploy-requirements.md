# WF-03 Production Deploy — Implementation Specification

## Purpose
WF-03 is the single production release workflow for TCE. A successful master release must build immutable ARM64 images, publish both images to GHCR, and request promotion in `phanthienquoc/platform-infra`.

## Trigger
- Run on every push to `master`.
- Support manual `workflow_dispatch`.

## Release identity
- Read `package.json` version.
- Build immutable tag: `prod-v<package-version>-<7-char-github-sha>`.
- The same tag must be used for frontend and backend images and for the platform-infra release request.

## Telegram start notification
- Require GitHub repository variables `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Fail early when either variable is missing.
- Send a compact production-release-start message with branch and short commit.

## Build frontend
- Runner: native `ubuntu-24.04-arm`.
- Verify machine architecture is `aarch64`.
- Build `Dockerfile` as `tce-frontend:<TAG>`.
- Verify image architecture is `arm64`.
- Export image as tar plus sha256 checksum.
- Upload artifact `tce-frontend-image`.

## Build backend
- Runner: native `ubuntu-24.04-arm`.
- Verify required monorepo paths exist.
- Verify machine architecture is `aarch64`.
- Build `apps/service/Dockerfile` with repository root as context.
- Build `tce-service:<TAG>`.
- Verify image architecture is `arm64`.
- Export image as tar plus sha256 checksum.
- Upload artifact `tce-service-image`.

## Publish release
After both builds succeed:
- Download the exact two artifacts from this workflow run.
- Verify checksums before loading.
- Load and verify the exact `<TAG>` images.
- Login to GHCR with `GITHUB_TOKEN`.
- Publish:
  - `ghcr.io/phanthienquoc/tce-dashboard/web:<TAG>`
  - `ghcr.io/phanthienquoc/tce-dashboard/service:<TAG>`

## Platform-infra promotion contract
- Require secret `PLATFORM_INFRA_TOKEN`.
- Dispatch repository `phanthienquoc/platform-infra`.
- Event type: `tce-release-requested`.
- Payload:
  - `app: tce-dashboard`
  - `release: <TAG>`
- Capture dispatch timestamp.
- Verify that the GitHub Actions workflow in platform-infra was scheduled after this dispatch.
- Verification must target the GitOps promotion workflow, not any arbitrary repository_dispatch run.

## Release summary
Write a GitHub step summary containing:
- immutable release tag
- published web image
- published service image
- dispatch event
- platform-infra verification result

## Reliability / safety
- `set -euo pipefail` in shell blocks.
- No mutable production image tags.
- No deployment directly from WF-03; platform-infra remains the GitOps/VPS deployment authority.
- Keep the workflow self-contained and readable.
- Preserve explicit workflow display metadata using top-level `name` and `run-name`.
