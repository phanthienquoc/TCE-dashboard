# Order Planner boundary

`planBuyOrder` converts a provider-neutral `TceDecision` plus allocator/buying-power context into a `TceOrderPlan`.

`createExecutionIntent` converts that plan into the provider-neutral `TceExecutionIntent` used by the later execution boundary.

No SSI SDK, HTTP client, database client, or provider DTO is imported here.
