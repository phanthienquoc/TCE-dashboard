# SSI Integration

TCE integrates SSI through `@ssi.developer/ssi-sdk` behind `SsiBrokerAdapter` and `SsiApplicationService`. The integration covers authentication, encrypted credential persistence, automatic token refresh, portfolio sync, market-price sync, and order-status streaming.

## 1. Core rule: database is the source of truth

For a persisted SSI connection, **the encrypted credential in Supabase is the source of truth**.

The frontend must not be required to resend SSI credentials just because the backend restarted or an access token expired.

```text
Supabase platform_credentials
        │
        │ SELECT credentials_encrypted
        ▼
SupabaseCredentialAdapter.get()
        │
        │ AES-256-GCM decrypt
        ▼
SsiApplicationService
        │
        │ credential + persisted token snapshot
        ▼
SsiBrokerAdapter
        │
        ├── access token valid ───────────────► reuse
        │
        ├── access token expired
        │      │
        │      └── refresh token valid ───────► SSI refresh()
        │                                             │
        │                                             ▼
        │                                    persist rotated tokens
        │                                             │
        │                                             ▼
        │                                    Supabase source of truth
        │
        └── no usable refresh token ─────────► SSI_REAUTH_REQUIRED
```

This lifecycle is shared by **portfolio, market data, account snapshots, health checks, and order-status streaming**.

## 2. Architecture

```text
FE
 │
 ▼
NestJS / apps/service
 │
 └── SsiApplicationService
       ├── load encrypted credential from Supabase
       ├── decrypt credential
       ├── build adapter
       ├── persist rotated tokens
       ├── portfolio sync
       ├── market-price sync
       └── order stream
              │
              ▼
       SsiBrokerAdapter (libs/ssi)
              │
              ├── one Auth instance
              ├── TokenManager
              ├── Trading
              ├── Data / MarketData
              └── Stream
                     │
                     ▼
                  SSI API v3
```

There must be **one authentication lifecycle per adapter**. Market data must not create an independent authentication object that ignores the persisted token.

## 3. Credential storage

Credentials are stored by user, provider and environment:

```text
platform_credentials
  user_id
  provider = ssi
  environment = production | staging | development
  credentials_encrypted
  ssi_account_no
  encryption_version
  is_active
```

The payload is encrypted with AES-256-GCM. The backend receives `TCE_CREDENTIAL_ENCRYPTION_KEY` from the runtime environment and decrypts the payload only inside `SupabaseCredentialAdapter`.

Required/generated fields:

| Field | Required | Description |
|---|---:|---|
| `apiKey` | Yes | SSI API key |
| `apiSecret` | Yes | SSI API secret |
| `clientId` | Optional | SSI client/application ID |
| `privateKey` | Optional | Required by authenticated trading flows when configured by SSI |
| `accountNo` | Required for portfolio/execution | Selected SSI account |
| `accessToken` | Generated | Current access token |
| `refreshToken` | Generated | Refresh token |
| `expiresAt` | Generated | Access-token expiry |
| `refreshExpiresAt` | Generated | Refresh-token expiry |

Tokens are stored inside the same encrypted credential payload. They are never stored in plaintext columns.

## 4. DB load and decrypt flow

`SsiApplicationService.adapter()` loads the credential through the injected `PlatformCredentialPort`:

```ts
const raw = await this.credentials.get(userId, 'ssi', environment);
```

The production implementation is `SupabaseCredentialAdapter`.

```text
credentials.get()
    ↓
SELECT credentials_encrypted
FROM platform_credentials
WHERE user_id = ?
  AND provider = 'ssi'
  AND environment = ?
  AND is_active = true
    ↓
AES-256-GCM decrypt
    ↓
raw credential object
```

The decrypted object is converted into `SsiConfig`, including the persisted token snapshot.

## 5. Token restore and automatic refresh

`SsiBrokerAdapter.createAuth()` restores the persisted token whenever both `accessToken` and `refreshToken` exist.

This restoration is intentionally independent of `privateKey` because the same authenticated token lifecycle is used for market data and portfolio operations.

### Authentication precedence

`authenticate()` follows this order:

1. Reuse a valid current/persisted access token.
2. If the access token is expired and a refresh token exists, call SSI `refresh()`.
3. Persist the resulting token snapshot immediately.
4. Only when no usable refresh token remains, require OTP/transaction ID.

```text
current access token valid
        │
        └── use it

current access token expired
        │
        ├── refresh token available
        │       │
        │       └── auth.refresh()
        │               ↓
        │          persistToken()
        │               ↓
        │          credentials.save()
        │
        └── refresh token missing/invalid
                ↓
          SSI_REAUTH_REQUIRED
```

A refresh operation is persisted because SSI may rotate either the access token or refresh token.

## 6. Concurrency protection

The adapter keeps a single `authenticatePromise` while authentication/refresh is running.

This prevents concurrent requests such as:

```text
portfolio sync ─┐
market sync ────┼──► refresh the same SSI session multiple times
health check ───┘
```

from issuing competing refresh requests.

The first request performs the refresh; concurrent requests await the same promise.

## 7. Portfolio synchronization

Portfolio sync uses the same authenticated `Auth` instance:

```text
syncPortfolio()
    ↓
authenticate()
    ↓
restore / refresh token if required
    ↓
Trading
 ├── account info
 ├── equity balance
 ├── equity positions
 └── today's orders
```

Successful data is persisted into TCE repositories. Zero-quantity positions/orders are excluded from the synced result.

A successful sync also updates `tce_accounts.capital_available` from the SSI cash balance.

## 8. Market-data synchronization

Market data **must reuse the exact same authenticated `Auth` instance** as portfolio/trading.

```text
marketPrices()
     ↓
authenticateMarketData()
     ↓
authenticate()
     ↓
same this.auth
     ↓
Data / MarketData
```

There is intentionally no independent `marketAuth` session anymore.

This fixes the previous failure mode where market sync created a separate auth object and could ignore the persisted access/refresh token.

### Intraday price

During the Vietnam equity session, TCE requests the latest 1-minute OHLC candle.

### Outside the session

If the 1-minute endpoint returns no usable candle, TCE falls back to daily historical OHLC and uses the latest available close.

An empty intraday response outside the market session is therefore a market-data condition, not proof that authentication failed.

## 9. Token persistence after refresh

When SSI returns a new token:

```text
SSI refresh()
     ↓
SsiBrokerAdapter.tokenSnapshot()
     ↓
onTokenUpdated()
     ↓
SsiApplicationService
     ↓
credentials.save(userId, 'ssi', environment, ...)
     ↓
SupabaseCredentialAdapter.encrypt()
     ↓
platform_credentials.credentials_encrypted
```

The original API credentials and the new token snapshot are merged before encryption, so a refresh does not destroy `apiKey`, `apiSecret`, `privateKey`, `clientId`, or `accountNo`.

## 10. Save/test flow

For a first-time connection:

1. FE submits SSI credentials.
2. BE creates a temporary adapter.
3. FE requests OTP/SSI approval if required.
4. BE tests authentication and market-data access.
5. BE reads the token snapshot.
6. `saveTested()` persists credentials + selected account + token snapshot.
7. A persisted session is created from that same complete payload.

After this point, normal sync operations should load the persisted credential and refresh automatically.

## 11. What happens after a backend restart?

Expected behavior:

```text
Backend restart
     ↓
new SsiApplicationService instance
     ↓
no in-memory session
     ↓
credentials.get()
     ↓
decrypt Supabase credential
     ↓
restore access + refresh token
     ↓
access valid? ── yes ──► continue
     │
     no
     ↓
refresh token valid? ── yes ──► refresh + persist
     │
     no
     ↓
SSI_REAUTH_REQUIRED
```

Therefore a backend restart alone must not force the user to re-enter SSI credentials.

## 12. Error semantics

Use these distinctions when debugging sync failures:

| Error | Meaning | Expected action |
|---|---|---|
| `SSI_REAUTH_REQUIRED` | No usable access/refresh token remains | Ask for SSI OTP/approval |
| `401` from SSI refresh | Persisted session can no longer be refreshed | Re-authenticate and save a new token |
| `PARTIAL_MARKET_DATA` | SSI returned only some requested symbols | Keep successful symbols; inspect failed symbols |
| `0/N requested symbols` outside session | No intraday candles available | Use daily-close fallback |
| Supabase credential load error | Backend cannot load/decrypt stored credential | Check DB row and `TCE_CREDENTIAL_ENCRYPTION_KEY` |

## 13. Dashboard persistence after sync

The dashboard reads persisted TCE state rather than relying only on the sync response.

| Data | Persistence source |
|---|---|
| Positions | `tce_positions` |
| Market price | `tce_positions.market_price` / market-price persistence |
| Market value | `tce_positions.market_value` |
| Unrealized P&L | `tce_positions.unrealized_pnl` |
| Cash | `tce_accounts.capital_available` |
| Orders | `tce_orders` |
| SSI account | `platform_credentials.ssi_account_no` |

This is separate from token persistence: authentication state is stored in the encrypted credential payload, while trading/dashboard state is stored in the corresponding TCE repositories/tables.

## 14. Implementation locations

| Responsibility | File |
|---|---|
| SSI authentication + token lifecycle | `libs/ssi/src/ssi.broker.adapter.ts` |
| Credential loading + application orchestration | `apps/service/src/platform/ssi.application.service.ts` |
| AES-256-GCM credential storage | `libs/db/src/supabase.credentials.adapter.ts` |
| Credential DI/configuration | `apps/service/src/platform/platform-credentials.module.ts` |
| Market-price scheduler | `apps/service/src/platform/ssi-market-price.service.ts` |
| Production deployment | `.github/workflows/wf-03-tce-deploy.yml` |

## 15. Production checklist

- [ ] `TCE_CREDENTIAL_ENCRYPTION_KEY` is present and persistent across deployments.
- [ ] The production SSI credential row is active.
- [ ] The encrypted credential contains `accessToken` and `refreshToken` after a successful authentication.
- [ ] `refreshExpiresAt` is persisted using the SSI SDK's actual token field name.
- [ ] Portfolio sync works after a backend restart without re-entering credentials.
- [ ] Market-price sync works after a backend restart without re-entering credentials.
- [ ] An expired access token causes automatic refresh and token persistence.
- [ ] A rotated refresh token replaces the old token in the encrypted DB payload.
- [ ] Only a missing/invalid refresh session results in `SSI_REAUTH_REQUIRED`.
- [ ] Market sync and portfolio sync share one authentication lifecycle.
- [ ] Outside market hours, market sync falls back from 1-minute OHLC to daily close.

## 16. Non-negotiable rule

> **Never make the frontend credential payload the normal source of authentication state once an SSI credential has been saved.**
>
> **Load → decrypt → restore → refresh → persist.**
>
> OTP/credential input is only the recovery path when the persisted SSI session can no longer be refreshed.
