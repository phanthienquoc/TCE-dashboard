# TCE Contract-First Architecture

## Rule

All application-to-infrastructure communication MUST go through an interface/contract. Domain and UI code must never depend directly on provider SDKs, HTTP clients, database clients, or provider-specific DTOs.

```text
Domain / Application
        |
        v
 Contract / Port
        |
        v
 Adapter / Implementation
        |
        v
External Provider
```

## Contract package

`libs/contracts` is the only shared boundary for cross-layer provider interactions.

It owns platform, dashboard, TCE repository/service, credential, SSI connection, error/result contracts and Nest DI tokens.

Provider implementations MUST return contract models and MUST NOT leak provider SDK DTOs.

## Result and error contract

Provider failures are normalized to `ContractResult<T>` with `ContractError` (`code`, `message`, `retryable`, `provider`). Supported classes include `UNAVAILABLE`, `UNAUTHORIZED`, `INVALID_INPUT`, `RATE_LIMITED`, `TIMEOUT`, and `PROVIDER_ERROR`.

## Implemented platform adapters

- `libs/ssi`: `SsiBrokerAdapter` — SSI SDK v3 is isolated here.
- `libs/binance`: `BinanceMarketAdapter` — Binance HTTP is isolated here.
- `libs/fastapi`: `FastApiMarketAdapter` — FastAPI HTTP is isolated here.
- `libs/db`: Supabase credential, position and order persistence adapters.

## Dashboard data boundary

Dashboard data is sourced through `DashboardDataSource` / `DashboardSourcePort`:

- Supabase: canonical TCE state (pools, next positions, persisted positions/orders/config).
- SSI: broker truth (cash, live positions, broker orders).
- FastAPI: market/signal/scanner data.

Every source reports availability, timestamp and errors through the contract result model.

## Application composition

`apps/service` contains controllers and composition/orchestration only. `SsiApplicationService` loads credentials through `PlatformCredentialPort`, creates the SSI adapter, and persists normalized data through `PositionRepository` / `OrderRepository`.

The legacy direct `SsiService`, `PlatformCredentialsService`, and `CredentialsCryptoService` were removed. Controllers no longer import provider SDKs or direct Supabase clients for platform operations.

Credential encryption remains backward-compatible with the existing `v1` AES-256-GCM format and `TCE_CREDENTIAL_ENCRYPTION_KEY` environment variable.

## Dependency direction

```text
apps/web ---------------------> application contracts
apps/service ------------------> application contracts

libs/tce ----------------------> libs/contracts
libs/dashboard-data -----------> libs/contracts
libs/ssi ----------------------> libs/contracts
libs/binance ------------------> libs/contracts
libs/fastapi ------------------> libs/contracts
libs/db -----------------------> libs/contracts

NEVER:
libs/tce ----------------------> SSI SDK
libs/tce ----------------------> Binance SDK
libs/tce ----------------------> Supabase SDK
apps/web ----------------------> provider SDK
apps/service ------------------> provider SDK / Supabase SDK
```

## Adding a new provider

1. Define or extend a contract in `libs/contracts`.
2. Implement an adapter under the appropriate library.
3. Map provider DTOs into contract DTOs.
4. Normalize failures to `ContractResult<T>`.
5. Register the adapter through application composition/DI.
6. Add contract-level tests and adapter integration tests.
7. Never expose provider-specific fields unless the contract explicitly requires them.

## Non-negotiable constraints

- No direct provider calls from TCE domain/application code.
- No provider DTO leakage across boundaries.
- No database access from UI.
- No credentials/secrets in domain contracts.
- Runtime failures use contract-level error/availability semantics where appropriate.
- Contract changes are treated as API changes and require compatibility consideration.
