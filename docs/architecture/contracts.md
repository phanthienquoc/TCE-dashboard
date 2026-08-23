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

It owns:

- platform contracts (`PlatformPort`, `MarketDataPort`, `AccountDataPort`)
- adapter ports (`BrokerPort`, `MarketProviderPort`, `DashboardSourcePort`)
- dashboard contracts (`DashboardDataSource`, `DashboardSnapshot`, `SourceResult`)
- TCE application ports (`PositionRepository`, `OrderRepository`, `MarketDataService`, `PortfolioService`)
- shared `ContractResult<T>` and `ContractError`

Provider implementations MUST return contract models and MUST NOT leak provider SDK DTOs.

## Result and error contract

Provider failures are normalized to:

```text
ContractResult<T>
  ├── { ok: true, data }
  └── { ok: false, error }
                         ├── code
                         ├── message
                         ├── retryable
                         └── provider
```

Supported error classes include `UNAVAILABLE`, `UNAUTHORIZED`, `INVALID_INPUT`, `RATE_LIMITED`, `TIMEOUT`, and `PROVIDER_ERROR`.

## Platform boundary

Platforms are adapters behind contracts:

- SSI: broker account, portfolio, orders, trading and market data.
- Binance: market/crypto data and exchange capabilities.
- FastAPI: internal market/signal/scanner service.

Provider SDK types are mapped at the adapter boundary and never cross into `libs/tce`, `libs/dashboard-data`, or `apps/web`.

## Dashboard data boundary

Dashboard data is sourced through `DashboardDataSource` / `DashboardSourcePort`:

- Supabase: canonical TCE state (pools, next positions, persisted positions/orders/config).
- SSI: broker truth (cash, live positions, broker orders).
- FastAPI: market/signal/scanner data.

Every source reports availability, timestamp and errors through the contract result model so a degraded provider does not take down the dashboard.

## TCE application ports

The TCE domain uses repository/service ports such as:

- `PositionRepository`
- `OrderRepository`
- `MarketDataService`
- `PortfolioService`

Implementations belong to adapters. The domain remains provider-agnostic.

## Dependency direction

```text
apps/web ---------------------> application contracts
apps/service ------------------> application contracts

libs/tce ----------------------> libs/contracts
libs/dashboard-data -----------> libs/contracts
libs/platform/* ---------------> libs/contracts
libs/* adapters ---------------> external SDK/API/DB

NEVER:
libs/tce ----------------------> SSI SDK
libs/tce ----------------------> Binance SDK
libs/tce ----------------------> Supabase SDK
apps/web ----------------------> provider SDK
```

## Adding a new provider

1. Define or extend a contract in `libs/contracts`.
2. Implement the adapter under the appropriate provider/platform library.
3. Map provider DTOs into contract DTOs.
4. Normalize failures to `ContractResult<T>`.
5. Register the adapter through application composition/dependency injection.
6. Add contract-level tests and adapter integration tests.
7. Do not expose provider-specific fields unless the contract explicitly requires them.

## Non-negotiable constraints

- No direct provider calls from TCE domain code.
- No provider DTO leakage across boundaries.
- No database access from UI.
- No credentials/secrets in domain contracts.
- Runtime failures use contract-level error/availability semantics where appropriate.
- Contract changes are treated as API changes and require compatibility consideration.
