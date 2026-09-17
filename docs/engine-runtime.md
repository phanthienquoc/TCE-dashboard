# TCE Engine Runtime

## Purpose

Engine Runtime is the orchestration layer that reads persisted engine configuration/state, resolves dependency readiness, and exposes one runtime view of the TCE engines.

It does **not** replace the existing scheduler and does **not** submit broker orders.

## Persisted sources

- `tce_engine_configs`: operator intent/configuration (`enabled`, per-engine config).
- `tce_engine_states`: runtime lifecycle state for an account/engine.
- `tce_cron_jobs` + `tce_cron_runs`: scheduler configuration and execution history for scheduled jobs.

## Canonical engine graph

```text
market/source readiness
        |
        v
TCE Decision Engine
        |
        v
SSI Execution Engine

Binance Market Engine is an independent market-data/external-market engine.
Binance XAU remains a separate configurable engine and is not a dependency of VN stock decision/execution flow.
```

The current repository declares `tce-decision`, `ssi-execution`, and `binance-market` as dashboard engine IDs. Runtime discovery may include additional persisted config IDs such as `binance-xau` without treating them as automatically runnable dependencies.

## Runtime status

The runtime projection uses these states:

- `ACTIVE`: configured and runtime-enabled, with all dependencies ready.
- `PAUSED`: explicitly configured disabled or explicitly inactive.
- `ERROR`: dependency/configuration/runtime health prevents activation.

Legacy `tce_engine_states.status` remains `ACTIVE|INACTIVE`; Runtime maps `INACTIVE` to `PAUSED` and preserves the persisted status separately.

## Activation rules

1. An engine must exist in `tce_engine_configs` or the canonical engine registry.
2. `config.enabled` must be true.
3. Persisted runtime state must not be `INACTIVE`.
4. All declared dependencies must be runtime `ACTIVE`.
5. Missing dependency state/config is treated as not-ready, not auto-started.
6. Runtime does not enable engines as a side effect of reading status.

## Current production observation

At the traced account, `tce-decision` is configured/enabled and persisted `ACTIVE`; `ssi-execution` and `binance-market` are configured disabled and persisted `INACTIVE`. The database also contains `binance-xau` configuration, but no corresponding `tce_engine_states` row.

The only persisted TCE cron job currently present is `stock-events-sync`, enabled on `0 */4 * * *` Asia/Ho_Chi_Minh with page size 20 and batch size 50. This cron job is a data-sync scheduler and should not be treated as an engine heartbeat.

## Non-goals

- Do not couple Runtime to a specific broker SDK.
- Do not submit live orders.
- Do not silently activate missing engine states.
- Do not infer dependency readiness from a cron job's existence alone.
