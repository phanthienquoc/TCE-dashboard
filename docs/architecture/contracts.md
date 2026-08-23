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

## Platform boundary

Platforms are adapters behind `PlatformPort` contracts:

- SSI: broker account, portfolio, orders, trading and market data.
- Binance: market/crypto data and exchange capabilities.
- FastAPI: internal market/signal/scanner service.

Provider SDK types must be mapped to TCE contract types at the adapter boundary. They must not cross into `libs/tce`, `libs/dashboard-data`, or `apps/web`.

## Dashboard data boundary

Dashboard data is sourced through `DashboardDataSource`:

- Supabase: canonical TCE state (pools, next positions, persisted positions/orders/config).
- SSI: broker truth (cash, live positions, broker orders).
- FastAPI: market/signal/scanner data.

Every source returns a `SourceResult<T>` with availability, timestamp and optional error so a degraded provider does not take down the dashboard.

## TCE application ports

The TCE domain uses repository/service ports such as:

- `PositionRepository`
- `OrderRepository`
- `MarketDataService`
- `PortfolioService`

Implementations belong to adapters. The domain must remain provider-agnostic.

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
2. Implement an adapter under the appropriate provider/platform library.
3. Map provider DTOs into contract DTOs.
4. Register the adapter through application composition/dependency injection.
5. Add contract-level tests and adapter integration tests.
6. Do not expose provider-specific fields unless the contract explicitly requires them.

## Non-negotiable constraints

- No direct provider calls from TCE domain code.
- No provider DTO leakage across boundaries.
- No database access from UI.
- No credentials/secrets in domain contracts.
- Runtime failures are represented through contract-level availability/error results where appropriate.
- Contract changes are treated as API changes and require compatibility consideration.
