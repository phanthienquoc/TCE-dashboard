# Senior Frontend Day 12 — Data Normalization and Cache Design

> Duration: 60 minutes. This lesson follows Day 11 and connects normalized client state, REST snapshots, and realtime TCE events. Documentation-only: it does not change runtime behavior, Supabase schema, credentials, strategy, or execution settings.


## Implementation readiness — cross-layer assessment

Before treating this lesson as complete, apply the shared [Learning Implementation Readiness Gate](IMPLEMENTATION_READINESS.md). A code snippet, test-only change, or documentation update is not proof that the product behavior exists end to end.

### TCE-specific inspection scope
- **System design:** identify canonical entities, their keys/scope, source of truth, and every real producer/consumer before normalizing state.
- **Service/API and persistence:** verify snapshot/event payloads, entity IDs, versions/timestamps, ordering and freshness guarantees from current contracts and schema. Do not assume the client can reject stale data without a trustworthy version rule.
- **Infrastructure:** assess only if the proposed cache/recovery policy relies on a service, persistent store, or deployment capability.
- **Integration:** test snapshot/event races, duplicates, out-of-order updates, account/venue scope, invalidation and reconnect recovery. Do not change Supabase schema/RLS or trading behavior as a shortcut.

Record a **READY / PARTIALLY READY / BLOCKED** decision. Implement real runtime behavior only where ownership and contracts are established; otherwise link a concrete item in [the cross-layer curriculum backlog](backlog/curriculum-implementation-backlog.md). Assess system design, infrastructure, service/backend, database, frontend and integration impacts; mark irrelevant layers N/A with a reason. Do not claim deployment or production verification without evidence.
## Learning objectives

By the end of this session, you should be able to:

- Explain normalized state and why nested copies drift out of sync.
- Choose stable entity keys and preserve account/venue scope.
- Merge a REST snapshot with realtime events without letting stale data overwrite newer state.
- Separate server state, UI state, and derived state.
- Design cache freshness, invalidation, and recovery policies.
- Use TypeScript reducers and selectors with predictable complexity.
- Apply these principles to the current TCE Dashboard stores and runtime-event contract.

## Minute plan

| Time      | Activity                     | Outcome                                                        |
| --------- | ---------------------------- | -------------------------------------------------------------- |
| 0–10 min  | Theory from first principles | Understand entities, identity, cache freshness, and trade-offs |
| 10–30 min | TypeScript/React code        | Normalize positions and quotes; reject stale updates           |
| 30–45 min | TCE architecture             | Design snapshot/event merging and cache boundaries             |
| 45–55 min | English interview practice   | Explain correctness, invalidation, and trade-offs              |
| 55–60 min | Review and quiz              | Check understanding                                            |

---

## 1. Theory — from first principles (10 minutes)

### 1.1 The problem: the same entity appears in many places

Imagine a dashboard response contains positions, orders, and a summary:

```ts
const dashboard = {
  positions: [
    { id: 'pos-1', symbol: 'DPM', quantity: 100, marketPrice: 42.5 },
    { id: 'pos-2', symbol: 'SSI', quantity: 200, marketPrice: 31.2 },
  ],
  watchlist: [
    { symbol: 'DPM', marketPrice: 42.5 },
    { symbol: 'GAS', marketPrice: 67.1 },
  ],
};
```

DPM appears in more than one place. A realtime quote arrives and changes DPM to 42.8. If the application copied DPM into five nested objects, it must remember to update all five copies. Missing one creates contradictory UI: the watchlist says 42.8 while the position card says 42.5.

This is a state duplication problem.

### 1.2 Normalize state: store each entity once

A normalized representation separates entities from the lists and relationships that refer to them:

```ts
type Quote = {
  symbol: string;
  price: number;
  observedAt: string;
};

type NormalizedQuotes = {
  bySymbol: Record<string, Quote>;
  allSymbols: string[];
};

const quotes: NormalizedQuotes = {
  bySymbol: {
    DPM: { symbol: 'DPM', price: 42.8, observedAt: '2026-10-29T02:00:00Z' },
    SSI: { symbol: 'SSI', price: 31.2, observedAt: '2026-10-29T02:00:00Z' },
    GAS: { symbol: 'GAS', price: 67.1, observedAt: '2026-10-29T02:00:00Z' },
  },
  allSymbols: ['DPM', 'SSI', 'GAS'],
};
```

Components store or receive an ID, then select the canonical entity from the map.

```text
Watchlist ───────┐
                 v
            quotesByKey
                 ^
Position card ───┘
```

Now one quote update changes one canonical record. Every component reading that record sees the same value after the store update.

**Normalization does not mean flatten every object.** Normalize shared, independently updated entities. Keep small, local value objects nested when flattening them would add complexity without preventing duplication.

### 1.3 Identity is a correctness boundary

A map only works if its key uniquely identifies the entity in the relevant scope.

- A market quote might use a composite key such as venue + symbol if the same symbol can exist on multiple venues.
- An account position may need account ID + position ID, or account ID + instrument + side, depending on the backend contract.
- An order should normally use its stable server order ID, not a row index.
- A list index is not an entity identity; sorting the list changes indices.

Do not assume symbol alone identifies a position. An account may hold multiple lots or sides for the same instrument. Do not trust an account ID supplied by arbitrary UI input to authorize access; account scope must come from the authenticated server context.

A safe key builder makes scope explicit:

```ts
type QuoteKeyInput = {
  venue: string;
  symbol: string;
};

function quoteKey(input: QuoteKeyInput): string {
  return `${input.venue.trim().toUpperCase()}:${input.symbol.trim().toUpperCase()}`;
}
```

For production, use the exact canonical identity defined by the backend contract. Do not invent a composite key that conflicts with server identity.

### 1.4 Why separate entity maps and ordered ID lists?

Normalized state often has two pieces:

```ts
type EntityState<T> = {
  byId: Record<string, T>;
  ids: string[];
};
```

- **byId** answers: “Give me entity X.”
- **ids** answers: “Which entities are in this view, and in what order?”

A filter or sort can create a derived ID list without copying every entity. Different views can maintain different lists while referring to the same canonical entities.

Trade-off: normalization adds indirection and requires more careful reducers/selectors. It is especially useful when entities are shared across views or updated independently.

### 1.5 Complexity

For n incoming entities and a hash-map-based representation:

- Normalize a batch: typically O(n).
- Read one entity by key: O(1) average.
- Merge one entity by key: O(1) average, excluding validation and derived calculations.
- Filter a list of n entities: O(n).
- Sort n entities: typically O(n log n).
- Store n entities plus their IDs: O(n) memory.

These are expected average costs for JavaScript object/Map lookups, not a hard real-time guarantee. A React render may still be expensive if a broad selector causes hundreds of components to rerender.

### 1.6 Three kinds of state

Do not put every kind of data into one global store.

| State category | Examples                                                   | Typical owner                                                      |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Server state   | Positions, orders, balances, runtime events                | Query/cache layer or domain store with explicit freshness/recovery |
| UI state       | Selected symbol, open drawer, active tab, temporary filter | React state or Zustand UI store                                    |
| Derived state  | Unrealized P/L, filtered position IDs, totals              | Selector or calculation from canonical data                        |

Derived values should usually not be stored independently if they can be calculated reliably from canonical data. Otherwise, the base value can change while a cached total remains stale.

A query library such as TanStack Query is designed to manage server-state fetching, caching, retries, and invalidation. Zustand is useful for shared client state and can also hold server responses, but then the application must explicitly implement freshness, invalidation, request deduplication, and recovery. Choose the model intentionally; do not assume adding another cache automatically makes state more correct.

### 1.7 Cache freshness and invalidation

A cached value has at least two separate questions:

1. **Do we have a value?**
2. **Is that value fresh enough for this use?**

A stale-while-revalidate UI may display the last snapshot while fetching a newer one, but it should label freshness accurately. A trading UI must not make stale balances or quotes look current.

Useful cache metadata can include:

```ts
type CacheMeta = {
  fetchedAt: number;
  status: 'fresh' | 'stale' | 'loading' | 'error';
  source: 'rest' | 'replay' | 'stream';
};
```

A timestamp alone does not prove ordering. Browser clocks can differ, and a response can contain data created before a newer event. Prefer server-provided version, cursor, sequence, or an explicit snapshot watermark where the contract supports it.

### 1.8 The snapshot/event race

This is the central realtime cache problem.

```text
t0  REST snapshot request starts
t1  Stream delivers DPM quote version 12
t2  REST response arrives containing older DPM quote version 11
```

If the client blindly replaces its state with the REST response, version 11 overwrites version 12. The UI moves backward.

Safer designs include:

1. The server returns a snapshot watermark/cursor; the client applies the snapshot, then replays events after that watermark.
2. The client uses a documented per-entity version/sequence and rejects older updates.
3. The client uses a request generation to stop an obsolete request from replacing the currently selected view.
4. If no comparable version exists, the client must use the API's documented consistency strategy; it must not invent ordering from local arrival time.

Do not compare sequence numbers from different aggregates as if they belonged to one global sequence. Do not use event time as a substitute for a sequence guarantee.

---

## 2. Code practice — TypeScript and React (20 minutes)

The examples below are teaching exercises. Adapt them to the real TCE contract and validation boundary before production use.

### Step 1 — Define a canonical quote and normalized state

```ts
type Quote = Readonly<{
  key: string;
  venue: string;
  symbol: string;
  price: number;
  observedAt: string;
  sequence?: number;
}>;

type QuoteState = {
  byKey: Record<string, Quote>;
  ids: string[];
};

function normalizeQuotes(items: readonly Quote[]): QuoteState {
  const byKey: Record<string, Quote> = {};
  const ids: string[] = [];

  for (const quote of items) {
    if (!Object.prototype.hasOwnProperty.call(byKey, quote.key)) {
      ids.push(quote.key);
    }
    byKey[quote.key] = quote;
  }

  return { byKey, ids };
}
```

Walkthrough:

1. Start with an empty map and ID list.
2. For each validated quote, add the key to the list only once.
3. Store the canonical quote in the map.
4. Return both the entity map and list order.

This is O(n) time and O(n) additional memory for n input quotes.

The function assumes each input quote has already passed runtime validation and that key identity is canonical.

### Step 2 — Merge a quote without moving state backward

```ts
type MergeResult =
  | { kind: 'inserted'; state: QuoteState }
  | { kind: 'updated'; state: QuoteState }
  | { kind: 'ignored-stale'; state: QuoteState }
  | { kind: 'needs-resync'; state: QuoteState };

function mergeQuote(state: QuoteState, incoming: Quote): MergeResult {
  const current = state.byKey[incoming.key];

  if (!current) {
    return {
      kind: 'inserted',
      state: {
        byKey: { ...state.byKey, [incoming.key]: incoming },
        ids: [...state.ids, incoming.key],
      },
    };
  }

  if (current.sequence !== undefined && incoming.sequence !== undefined) {
    if (incoming.sequence < current.sequence) {
      return { kind: 'ignored-stale', state };
    }

    if (incoming.sequence === current.sequence) {
      // Equal sequence is only safely treated as duplicate if the
      // producer contract says sequence identifies the same state version.
      return { kind: 'ignored-stale', state };
    }

    if (incoming.sequence > current.sequence + 1) {
      return { kind: 'needs-resync', state };
    }
  }

  return {
    kind: 'updated',
    state: {
      ...state,
      byKey: { ...state.byKey, [incoming.key]: incoming },
    },
  };
}
```

Important trade-offs:

- This sample assumes the producer's sequence is comparable for the same quote key. Do not apply it to events whose contract lacks that guarantee.
- A sequence gap may require replay, not just ignoring the new value.
- If the backend uses a version that increments by more than one for intentionally filtered events, the gap policy must follow that contract.
- This code clones the top-level map, which is O(n) in the number of keys. A persistent data structure or store-specific update strategy may help at very large scale, but measure before optimizing.
- Runtime validation must happen before this function.

### Step 3 — Keep event identity separate from entity identity

An event ID identifies a message. An entity key identifies the object being updated. They solve different problems.

```ts
type QuoteUpdatedEvent = {
  eventId: string; // dedupe the event
  eventType: 'market.quote.updated';
  aggregateId?: string; // event contract identity, if supplied
  sequence?: number; // order only within its guaranteed scope
  data: Quote;
};
```

If the same event is delivered twice, dedupe by eventId. If a newer event updates the same quote, merge by the quote's canonical key and version policy. Never use eventId as the quote's entity key.

### Step 4 — Select narrowly in React

A broad selector can rerender every quote row when any quote changes. Prefer selecting the one entity needed by a row.

```tsx
'use client';

import { useDashboardStore } from '@/lib/store';

type QuoteRowProps = {
  quoteKey: string;
};

export function QuoteRow({ quoteKey }: QuoteRowProps) {
  const quote = useDashboardStore(state => state.marketPrices[quoteKey]);

  if (!quote) return <div>Waiting for quote…</div>;

  return (
    <div>
      <strong>{quote.symbol}</strong>
      <span>{quote.price.toFixed(2)}</span>
    </div>
  );
}
```

This snippet illustrates the selector principle. Verify the actual store key and exported hook in the target TCE module before copying it verbatim; current TCE code may key market prices by symbol rather than venue + symbol.

Why it helps: a component subscribes to the smallest state slice it needs. Whether it avoids a rerender depends on the store's selector/equality behavior and whether the selected value's identity changes.

### Step 5 — Prevent a stale REST response from overwriting newer state

A request generation is useful when requests are superseded:

```ts
let snapshotRequestVersion = 0;

async function refreshSnapshot() {
  const version = ++snapshotRequestVersion;
  const snapshot = await loadDashboardSnapshot();

  if (version !== snapshotRequestVersion) {
    return; // a newer request owns the result
  }

  applySnapshot(snapshot);
}
```

This protects against overlapping requests, but it does not by itself solve the snapshot/event race. A response can be the latest request and still contain an older domain version than a stream event.

For snapshot/event correctness, combine request ownership with a server-defined watermark or version policy, then replay events after the snapshot's watermark where supported.

### Step 6 — Test the invariants

At minimum, test:

1. Normalizing duplicate keys leaves one canonical entity and a unique ID list.
2. A stale version cannot overwrite a newer version.
3. A duplicate event ID is not applied twice.
4. A detected gap triggers recovery and does not advance the applied cursor.
5. A snapshot older than the current watermark cannot move state backward.
6. Account-scoped entities from different accounts cannot collide.
7. Logout clears account-sensitive cache and subscriptions.

---

## 3. TCE architecture and real-world use case (15 minutes)

### 3.1 What the repository currently shows

The current TCE frontend already uses Zustand stores and Axios-based API functions:

- **apps/web/lib/tce-data-store.ts** keeps several prefetched API results such as dashboard data, engines, configuration, and Telegram-related data. It has an in-flight promise to deduplicate concurrent prefetch calls and a clear operation.
- **apps/web/lib/store.ts** contains dashboard/auth state and a market-price map keyed by symbol. It also has request cancellation/versioning for parts of the dashboard loading flow and normalization logic for dashboard pools.
- **apps/web/lib/api.ts** exposes dashboard endpoints for account, positions, market prices, orders, pools, and other resources.
- **libs/contracts/src/tce-event.contract.ts** defines the canonical runtime event envelope and event-specific data contracts.
- **apps/service/src/runtime-events/runtime-events.query.service.ts** queries persisted runtime events for the authenticated account, orders them by occurredAt and eventId, and supports the after + afterEventId cursor.

These are useful foundations, but they do not mean every response in the application is already normalized into one canonical entity graph. Some stores still hold broad response objects or use any. Treat normalization as a targeted design improvement, not as a claim that the entire production app has already adopted a fully normalized cache.

### 3.2 Recommended data flow

```text
REST snapshot ─────────────┐
                           v
Runtime events ──> Validate contract
                           |
                           v
                 Normalize entity identity
                           |
                           v
              Merge using version/watermark
                           |
                 +---------+---------+
                 |                   |
                 v                   v
          Canonical entities     Cache metadata
          by stable key          cursor/freshness
                 |                   |
                 +---------+---------+
                           v
                    Narrow selectors
                           |
                           v
                   React dashboard UI
```

Responsibilities:

- **API/transport layer:** fetch data and handle cancellation/errors.
- **Validation layer:** validate untrusted JSON against runtime contracts.
- **Normalization layer:** map responses into canonical entities and relationships.
- **Merge layer:** apply version, cursor, duplicate, and stale-data rules.
- **Store/cache:** retain canonical entities and freshness metadata.
- **Selectors:** derive filtered/sorted IDs and computed values.
- **Components:** render the selected data and make stale/degraded state visible.

### 3.3 A safe snapshot plus event strategy

Suppose TCE loads account positions through REST while the runtime stream is active.

A robust contract should define a consistent boundary, for example a snapshot watermark W:

1. Request the snapshot.
2. The server returns the snapshot and a watermark/cursor W that describes the state represented by the snapshot.
3. Normalize the snapshot into canonical entities.
4. Replace or merge the snapshot according to a documented atomicity policy.
5. Replay events strictly after W.
6. Apply each event idempotently, validating identity and version.
7. Mark the view fresh only after replay catches up to the live stream.

If the backend does not currently return a suitable snapshot watermark, do not pretend the frontend can derive a perfect boundary from local timestamps. Use the documented API semantics, or plan a backend contract change separately.

### 3.4 Invalidation policy by resource

| Resource                | Typical policy                                                          | Reason                                                  |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Market quote            | Stream update plus periodic resync/freshness check                      | High update frequency; latest value matters for display |
| Positions               | Snapshot plus validated account/execution events and reconciliation     | Incorrect position state is financially significant     |
| Orders/executions       | Stable IDs, idempotent updates, replay/reconciliation                   | Duplicate or missing transitions are dangerous          |
| Engine configuration    | Refetch/invalidate after a successful config mutation                   | Low frequency, explicit user changes                    |
| Historical price series | Cache by symbol + interval + date range; invalidate on known correction | Repeated queries are expensive; ranges differ           |
| UI tab/filter/drawer    | Local UI state; usually no network cache                                | Not server-owned data                                   |

These are design recommendations, not assertions that every resource currently implements this exact policy.

### 3.5 Zustand vs query cache

For the current repository, Zustand is already in use. A practical migration does not require replacing it wholesale.

- Keep cross-screen UI state in Zustand where it makes sense.
- If adopting TanStack Query for server data, let it own request lifecycle, query keys, stale times, and invalidation for the resources migrated to it.
- Avoid storing the same server response independently in both TanStack Query and Zustand unless there is a clear ownership and synchronization rule.
- For event-driven normalized entities, a domain store may still be appropriate, but it needs explicit cursor, freshness, and recovery behavior.
- Do not add a new library just to rename an existing problem. First define identity, ownership, invalidation, and consistency.

### 3.6 Account isolation and logout

Any account-sensitive cache must be scoped to the authenticated identity. On account switch or logout:

- clear account-sensitive stores and cached query data;
- stop subscriptions and in-flight requests;
- prevent a late response from the previous account from repopulating state;
- reinitialize data only after the new session is validated.

A cache key that omits account scope can leak one account's data into another account's view even if the backend correctly authorizes every request.

### 3.7 Senior-level trade-offs

- **Normalized entities:** consistent updates and efficient lookup, at the cost of indirection and more reducer/selector code.
- **Denormalized snapshots:** simple rendering for isolated pages, but duplicated entities can drift when shared across views.
- **One global store:** convenient access, but broad subscriptions and mixed ownership make invalidation difficult.
- **Per-resource cache:** clearer ownership and invalidation, but cross-resource consistency requires explicit coordination.
- **Optimistic UI:** responsive, but risky for financial state unless rollback, idempotency, and server reconciliation are designed.
- **Client timestamps:** easy to collect, but not a reliable substitute for server ordering guarantees.

### Verification checklist

- [ ] Every entity has a stable, scope-correct key.
- [ ] Lists store IDs rather than duplicate copies of shared entities.
- [ ] Event ID and entity ID are not confused.
- [ ] Snapshot/event ordering uses a server contract, watermark, or version—not arrival time alone.
- [ ] Cache freshness is visible and independent of transport connection status.
- [ ] Query invalidation has one clear owner.
- [ ] Account switch/logout clears sensitive cache and cancels old work.
- [ ] High-frequency updates do not force unrelated components to rerender.
- [ ] No runtime, Supabase, strategy, or live-execution settings are changed by this lesson.

---

## 4. English interview practice (10 minutes)

### Question 1: What is normalized state, and when would you use it?

**Sample answer:**

> Normalized state stores each shared entity once in a map keyed by a stable identifier, while lists and relationships refer to those identifiers. It prevents duplicated copies of the same entity from drifting out of sync and makes single-entity lookup efficient. I use it when entities are shared across views or updated independently. For small, isolated view models, denormalized data may be simpler.

### Question 2: How do you prevent a stale REST snapshot from overwriting a newer WebSocket update?

**Sample answer:**

> A request version guard prevents an obsolete request from winning a race, but it does not solve every snapshot-versus-stream race. I prefer a server-defined snapshot watermark or entity version. I normalize the snapshot, replay events after its watermark, and apply updates idempotently. If the API has no comparable version or watermark, I do not invent ordering from browser arrival time; I define a consistency strategy with the backend.

### Question 3: How would you design cache invalidation for a trading dashboard?

**Sample answer:**

> I classify data by ownership and update frequency. UI state stays local or in a client store. Server snapshots use a query/cache policy, while event-driven entities use stable identities, version-aware reducers, and explicit replay or reconciliation. Quotes can use a freshness policy suitable for display, but positions and execution state require stronger consistency. On logout or account switch, I clear account-scoped caches and cancel old requests.

### Speaking drill

Use this structure for each answer:

**Problem → Data model → Consistency rule → Trade-off.**

Aim for 60–90 seconds per answer. Avoid saying only “I would use Zustand” or “I would use React Query”; explain ownership and correctness first.

---

## 5. Review and quick quiz (5 minutes)

### Question 1

Why normalize a position or quote instead of copying it into every component's state?

**Answer:** One canonical entity prevents duplicated copies from diverging. Components select the same entity by stable key, while lists maintain their own IDs/order.

### Question 2

A REST snapshot returns after a newer stream event. Is the latest-arriving response always the truth?

**Answer:** No. Arrival order is not domain version order. Use a server watermark or comparable version, apply the snapshot at its documented boundary, and replay events after that boundary.

### Question 3

What must happen when a user logs out while a request is still in flight?

**Answer:** Clear account-sensitive state/cache, cancel or invalidate old work, stop subscriptions, and ensure a late response cannot repopulate the previous account's state.

## End-of-session takeaway

Normalization solves duplicated entity state. Cache policy solves ownership and freshness. Version/watermark-aware merging solves the race between snapshots and realtime events. These are related problems, but none can replace the others.

Next: **Day 13 — Performance profiling**, focusing on measuring React renders, identifying expensive selectors and list rendering, and optimizing only after locating the actual bottleneck.
