# SSI Integration

TCE integrates with SSI through `@ssi.developer/ssi-sdk` behind a broker/application-service boundary. The integration covers authentication, market data, portfolio synchronization, order execution/status streaming, and persistence.

## 1. Architecture

```text
FE
 │
 ▼
NestJS / apps/service
 │
 ├── SsiApplicationService
 │      ├── credential loading / persistence
 │      ├── per-user + environment session cache
 │      ├── portfolio sync
 │      ├── market-price sync
 │      └── order-status reconciliation
 │
 ▼
SsiBrokerAdapter (libs/ssi)
 │
 ├── Auth
 ├── Trading
 ├── Data / MarketData
 └── Stream
 │
 ▼
SSI API v3
```

The adapter keeps SSI-specific SDK details out of the application layer. The application service owns user/environment isolation and persistence into TCE repositories/Supabase.

## 2. Credentials and environments

SSI credentials are stored per TCE user and environment. The application service resolves them using the platform credential repository with the provider key `ssi`.

Expected fields:

| Field | Required | Purpose |
|---|---:|---|
| `apiKey` | Yes | SSI API key |
| `apiSecret` | Yes | SSI API secret |
| `clientId` | No | SSI client/application ID when required |
| `privateKey` | No | Private key used by authenticated trading flows |
| `accountNo` | No until account selection | Selected SSI account for execution/portfolio operations |

Production credentials must never be committed to Git. TCE stores encrypted platform credentials and only materializes them inside the service session.

## 3. Authentication flow

### OTP / approval

1. FE submits SSI configuration for the selected environment.
2. BE creates an SSI adapter from the supplied credentials.
3. `requestOtp()` asks SSI to start the authentication/approval flow.
4. FE receives the returned `transactionId` when SSI provides one.
5. FE submits either the OTP or transaction ID to the test/connect endpoint.
6. The adapter authenticates and creates the SSI `Trading` client.

The adapter reuses an existing authenticated Bearer token where possible. This is important for the manual sync flow because market-data calls can use the authenticated trading token instead of requesting a second token.

## 4. Connection test before save

The connection test is deliberately performed before credentials are persisted.

`SsiBrokerAdapter.test()` verifies:

- authentication;
- SSI API v3 access;
- HOSE security/market-data access;
- account information when an authenticated trading session is available.

Only after the test succeeds does `SsiApplicationService.saveTested()` persist the credentials and selected account.

This keeps invalid credentials out of the persistent credential store.

## 5. Portfolio synchronization

The current-account flow reads:

- accounts;
- equity balance;
- equity positions;
- today's orders.

`syncPortfolio()` filters out zero-quantity positions/orders before the application service persists them. Position and order records are upserted using the TCE repositories.

A successful order-status event (`FF`, `PF`, or `FFPC`) triggers a fresh position read so the local position state is reconciled with SSI.

## 6. Order-status streaming

After a successful connection/save, TCE starts the SSI V3 trading stream for the selected account.

```text
SSI WebSocket
     │
     ▼
Stream.onTrading
     │
     ▼
orderEvent
     │
     ▼
SsiApplicationService.handleOrderEvent()
     │
     ├── upsert order
     └── refresh positions on filled/partial-fill states
```

The stream is stopped when the adapter disconnects. Sessions are cached by:

```text
<userId>:ssi:<environment>
```

so users and environments do not share SSI sessions.

## 7. Market data

TCE uses two different SSI OHLC APIs depending on the market state.

### Intraday

During the Vietnam equity trading session, market-price synchronization uses the latest 1-minute OHLC candle for each symbol.

### Outside the intraday session

SSI can legitimately return an empty result from the 1-minute endpoint outside the active intraday window. An empty result is **not** treated as an authentication failure.

For manual synchronization outside the session, TCE falls back to the daily historical OHLC endpoint and uses the latest daily close.

This prevents the dashboard from showing:

```text
PARTIAL_MARKET_DATA
SSI returned 0/N requested symbols
```

when the real reason is simply that the market is closed.

### Price persistence

Market prices are persisted into `tce_market_prices` using:

```text
user_id + symbol + trading_date
```

as the logical upsert key.

For open positions, the latest market price updates:

```text
market_price
market_value = quantity * market_price
unrealized_pnl = quantity * (market_price - avg_cost)
```

## 8. Market-price scheduler

The service scheduler evaluates Vietnam time (`Asia/Ho_Chi_Minh`) once per minute.

Hourly market-price synchronization is allowed only during the actual weekday equity session window. It does not repeatedly call the intraday SSI endpoint at night, on weekends, or during inactive hours.

A separate daily-close synchronization runs after the trading session and records `close_price`.

The scheduler is intentionally application-local. A future horizontally scaled deployment should move the schedule to a single-worker/queue/cron mechanism so multiple service replicas cannot execute the same sync concurrently.

## 9. Manual `Sync now`

Manual sync follows the same market-data abstraction as the scheduler:

```text
Sync now
  │
  ├── session active → 1-minute OHLC
  │
  └── session inactive / no intraday candle
          ↓
      daily historical OHLC
          ↓
      latest close
```

The endpoint returns partial-sync information when SSI returns only a subset of requested symbols. The UI should surface the successful symbols and failed symbols rather than interpreting the entire request as an authentication failure.

## 10. Error semantics

The broker adapter wraps provider failures in `ContractResult`:

```ts
{
  ok: false,
  error: {
    code: 'PROVIDER_ERROR',
    message: '...',
    retryable: false,
    provider: 'ssi'
  }
}
```

Market-price synchronization adds domain-level partial-data information:

```text
PARTIAL_MARKET_DATA
```

Use the distinction carefully:

- `401` / authentication error → credential/session problem;
- provider/network error → SSI/API availability problem;
- `0/N` intraday symbols outside session → expected market-data condition;
- `M/N` symbols during session → partial provider data or symbol-specific issue.

## 11. Current implementation locations

| Responsibility | Location |
|---|---|
| SSI SDK adapter | `libs/ssi/src/ssi.broker.adapter.ts` |
| SSI application orchestration | `apps/service/src/platform/ssi.application.service.ts` |
| Market-price scheduler | `apps/service/src/platform/ssi-market-price.service.ts` |
| Production k3s manifests | `infra/k3s/service-prod.yaml`, `infra/k3s/frontend-prod.yaml` |
| Production deployment | `.github/workflows/wf-03-tce-deploy.yml` |

## 12. Production checklist

Before enabling SSI in production:

- [ ] API key and API secret are configured for the correct environment.
- [ ] Private key/client ID are configured when required by the SSI account.
- [ ] Account number has been selected after a successful connection test.
- [ ] Credentials are stored only through the encrypted platform credential path.
- [ ] `TCE_CREDENTIAL_ENCRYPTION_KEY` is persistent across deployments.
- [ ] Manual Sync works both during and outside the Vietnam market session.
- [ ] Market prices for positions and WATCHING pool symbols are persisted.
- [ ] Order-status streaming reconnect/health monitoring is available before relying on it for critical execution reconciliation.

## 13. Known SSI market-data behavior

Do not use the absence of intraday candles as proof that SSI authentication failed. Authentication and market-data availability are separate concerns.

The production-safe rule is:

> **Intraday endpoint during session; daily historical close outside session.**

This rule is also used by the dashboard manual synchronization path so that an operator can safely refresh the portfolio after market hours.
