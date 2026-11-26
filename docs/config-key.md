# TCE configuration keys

This document records runtime configuration keys used by TCE and where each key is sourced from.

## Service runtime keys

| Key                             | Purpose                                               | Source                                                    | Kubernetes mapping                          |
| ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `SUPABASE_URL`                  | Supabase project URL                                  | GitHub Actions secret/environment                         | `tce-app-secrets.SUPABASE_URL`              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Backend Supabase service-role access                  | GitHub Actions secret/environment                         | `tce-app-secrets.SUPABASE_SERVICE_ROLE_KEY` |
| `JWT_SECRET`                    | JWT signing secret                                    | GitHub Actions secret/environment                         | `tce-app-secrets.JWT_SECRET`                |
| `JWT_REFRESH_TTL_SECONDS`       | Refresh-token lifetime                                | Deployment config                                         | `2592000`                                   |
| `MFA_ENCRYPTION_KEY`            | Encryption key for MFA-related secrets                | Existing `tce-auth` Kubernetes secret                     | `tce-auth.MFA_ENCRYPTION_KEY`               |
| `TCE_CREDENTIAL_ENCRYPTION_KEY` | Encryption key for stored platform/broker credentials | GitHub Actions secret `TCE_CREDENTIAL_ENCRYPTION_KEY_STG` | `tce-auth.TCE_CREDENTIAL_ENCRYPTION_KEY`    |

## `TCE_CREDENTIAL_ENCRYPTION_KEY`

This key is **new** and is separate from `MFA_ENCRYPTION_KEY`.

It is required at service startup by `apps/service/src/platform/platform-credentials.module.ts`. The module reads `process.env.TCE_CREDENTIAL_ENCRYPTION_KEY` and passes it to `SupabaseCredentialAdapter` as the credential-encryption key.

### Staging source flow

```text
GitHub Actions secret
TCE_CREDENTIAL_ENCRYPTION_KEY_STG
        |
        v
workflow env: TCE_CREDENTIAL_ENCRYPTION_KEY
        |
        v
kubectl apply -> tce-stg/tce-auth
        |
        v
tce-auth.TCE_CREDENTIAL_ENCRYPTION_KEY
        |
        v
Deployment env: TCE_CREDENTIAL_ENCRYPTION_KEY
```

The staging deployment workflow provisions/updates the `tce-auth` Kubernetes Secret from the GitHub Actions secret before applying the service deployment.

### Secret handling

- Do not commit the key value to Git.
- Create `TCE_CREDENTIAL_ENCRYPTION_KEY_STG` as a GitHub Actions repository/environment secret.
- The key must remain stable after credentials have been encrypted; rotating it requires an explicit credential re-encryption/migration strategy.

## Related source files

- `apps/service/src/platform/platform-credentials.module.ts`
- `libs/db/src/supabase.credentials.adapter.ts`
- `infra/k3s/service-stg.yaml`
- `.github/workflows/wf-04-tce-staging-deploy.yml`
