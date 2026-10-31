# MicroFE standalone

The MicroFE release workflow publishes two immutable GHCR images:

- `ghcr.io/phanthienquoc/microfe-shell`
- `ghcr.io/phanthienquoc/microfe-ws`

The legacy `microfe/auth` source remains test-only in this repository and is not published by the production release workflow. The canonical Auth service image is owned and released by `phanthienquoc-authentication` as `ghcr.io/phanthienquoc/auth-service/auth`.

TCE-dashboard owns runtime source, Dockerfiles, tests, and the MicroFE publish workflow.

platform-infra remains the production Kubernetes/GitOps source of truth. It consumes
the `microfe-images-published` repository_dispatch event from this repository and
promotes the published image digests into the production Kustomize overlay. The
payload includes the full source `commit`, the derived `release` label
(`microfe-<first 7 SHA characters>`), and immutable `shell_digest` and
`ws_digest` values. Auth is released independently by the authentication repository. The producer verifies this payload before dispatch and
correlates the returned GitOps run by the release label, not by an exact workflow
name that can change with run-name metadata.

The existing GitHub secret name `PLATFORM_INFRA_TOKEN` is reused. Secret values remain in GitHub Settings and are never committed.

Migration is phased: TCE publish first, then production promotion and verification, then removal of duplicated MicroFE runtime/build ownership from platform-infra.
