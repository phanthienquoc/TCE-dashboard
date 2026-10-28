# Senior Frontend Day 11 — WebSocket, SSE, Reconnection and Backpressure

> Duration: 60 minutes. This lesson follows Day 10 and is grounded in the current TCE Dashboard runtime-event contracts. It is documentation-only: no transport behavior, trading logic, credentials, database schema or runtime flags are changed.

## Learning objectives

By the end of the session, you should be able to:

- Explain polling, WebSocket and Server-Sent Events (SSE).
- Reconnect with bounded exponential backoff and jitter.
- Distinguish transport reconnection from data recovery.
- Deduplicate events and detect sequence gaps without assuming every sequence is globally ordered.
- Use a durable cursor to replay events after reconnect.
- Explain backpressure and when coalescing is safe.
- Keep UI rendering optimization separate from financial-data correctness.

## Minute plan

| Time | Activity | Outcome |
| --- | --- | --- |
| 0–10 min | Theory from first principles | Understand push transports, reconnection and event ordering |
| 10–30 min | TypeScript code practice | Implement a small event consumer with dedupe, gap detection and backoff |
| 30–45 min | TCE architecture | Map the lesson to existing runtime events, SSE and WebSocket boundaries |
| 45–55 min | English interview practice | Explain resilience and data correctness |
| 55–60 min | Review and quiz | Check understanding |

---

## 1. Theory — from first principles (10 minutes)

### 1.1 Polling vs WebSocket vs SSE

Think of a dashboard asking for updates:

- **Polling:** the client asks, “Anything new?” every N seconds.
- **SSE:** the client opens an HTTP stream; the server sends events in one direction.
- **WebSocket:** client and server establish a persistent, bidirectional connection. The protocol supports two-way messaging, even if a particular application intentionally makes its channel read-only.

| Transport | Direction | Strengths | Trade-offs |
| --- | --- | --- | --- |
| REST polling | Client asks repeatedly | Simple, easy to retry and inspect | Repeated requests; freshness is limited by poll interval |
| SSE | Server → client | HTTP-based, event IDs, browser reconnect support | One-way; native EventSource cannot set arbitrary Authorization headers |
| WebSocket | Both directions | Persistent, low-overhead messaging, supports interactive protocols | Connection lifecycle, auth, reconnect, ordering and queueing are application responsibilities |

A WebSocket connection being open does not prove that the client has every event. A disconnected client may miss events, and a connection may be alive while the application is no longer making progress. **Connection health and data completeness are different properties.**

### 1.2 A reconnect is not a recovery strategy

Suppose the client receives events 41 and 42, loses its connection, then reconnects.

~~~text
Server: 41 ---- 42 ---- 43 ---- 44 ---- 45
Client: 41 ---- 42     DISCONNECTED
                         reconnect
Client:                         45
~~~

If the server only starts sending new events after reconnect, events 43 and 44 are lost from the client's view.

A robust design needs both:

1. **Reconnect:** restore the transport.
2. **Replay/resynchronization:** recover the events or state missed during the outage.

TCE's canonical runtime event API supports a durable cursor using the **after** timestamp and **afterEventId**. After reconnect, the consumer can request events after its last applied cursor. For a stateful view, it may also need an authoritative snapshot followed by replay, according to the endpoint contract.

### 1.3 Event identity, order and schema

TCE's canonical event envelope lives in **libs/contracts/src/tce-event.contract.ts** and contains:

~~~ts
type TceEventEnvelope<TType extends string, TData> = Readonly<{
  eventId: string;
  eventType: TType;
  schemaVersion: 1;
  occurredAt: string;
  producer: string;
  correlationId: string;
  accountId?: string;
  aggregateId?: string;
  sequence?: number;
  data: TData;
}>;
~~~

Important distinctions:

- **eventId** identifies one event and is the deduplication key.
- **correlationId** connects events from one workflow, such as an execution lifecycle.
- **aggregateId** identifies the entity whose state changes.
- **sequence**, when supplied, is monotonic only within the producer's documented ordering scope (commonly an aggregate), not automatically across every event in the account.
- **schemaVersion** lets a consumer reject or deliberately handle incompatible payloads.
- **occurredAt** is event time, not necessarily the order in which a browser receives the event.

**Do not use an optional per-aggregate sequence as a global cursor.** Keep a durable replay cursor such as timestamp + event ID, and use sequence values only within their guaranteed scope.

### 1.4 Deduplication and gap detection

Networks and reconnects can cause repeated delivery. A consumer should be idempotent where possible:

~~~ts
if (seenEventIds.has(event.eventId)) {
  return; // already applied
}
~~~

If a sequence is guaranteed per aggregate, track the last sequence by aggregate:

~~~ts
const key = event.aggregateId;
const previous = lastSequenceByAggregate.get(key);

if (previous !== undefined && event.sequence !== undefined) {
  if (event.sequence > previous + 1) {
    requestReplayOrResync(key, previous + 1, event.sequence);
  }

  if (event.sequence <= previous) {
    return; // stale or duplicate for this aggregate
  }
}
~~~

This is illustrative: the exact sequence policy must match the producer contract. Some event types may have no sequence, and a gap should trigger recovery—not an invented event or a silent assumption that state is complete.

**Complexity:** checking a hash set/map is O(1) average per event. Processing a batch of n events is generally O(n), excluding payload-specific work. A bounded dedupe cache uses O(k) memory for a chosen cap k; eviction means durable replay/cursor logic is still needed for correctness.

### 1.5 Reconnection: exponential backoff with jitter

A client that reconnects every 100 ms can overload a service during an outage. Exponential backoff increases the delay after repeated failures:

~~~ts
const base = Math.min(30_000, 500 * 2 ** attempt++);
const jitter = Math.floor(Math.random() * Math.max(100, base * 0.25));
const delay = base + jitter;
~~~

- Base delay grows: 500 ms, 1 s, 2 s, 4 s … up to a cap.
- Jitter randomizes clients' retry times so thousands of clients do not reconnect together.
- Reset the failure counter only after a meaningful successful connection; if connections repeatedly open and close immediately, resetting too eagerly can create a rapid reconnect loop.
- Stop timers and close sockets when the owner logs out or unmounts.
- Treat authentication failures differently from transient network failures. Repeatedly reconnecting with an invalid session is not resilience.

### 1.6 Backpressure: what if events arrive faster than the UI can process?

Backpressure is the mismatch between the rate of incoming data and the rate at which a consumer can process it.

For example, a market quote may update dozens of times per second while React rendering and chart drawing are slower.

- **Display-only quote tiles:** it may be safe to coalesce intermediate updates and keep the latest quote per symbol for rendering.
- **Candlestick visualization:** batch UI updates and render at a controlled frame rate, while preserving the correct OHLC aggregation upstream.
- **Execution results, risk decisions, reconciliation and audit events:** do not silently drop events. Use durable replay, bounded queues with explicit overflow recovery, or authoritative snapshot/reconciliation.
- **Any overflow or detected gap:** mark the view stale/degraded and recover; never continue presenting it as fully current.

The browser's classic WebSocket API does not provide automatic application-level backpressure. A callback that queues every message in an unbounded array can exhaust memory. Conversely, blindly dropping messages may corrupt domain state.

**Key distinction:** it can be acceptable to skip intermediate *renders* while retaining every required *domain transition*. Rendering optimization must not become data loss.

---

## 2. Code practice — TypeScript (20 minutes)

The following is a teaching exercise, not a replacement for TCE's existing transport client. It shows the core invariants without coupling them to a specific socket library.

### Step 1 — Define a minimal typed event

~~~ts
type RuntimeEvent<T = unknown> = Readonly<{
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  correlationId: string;
  aggregateId?: string;
  sequence?: number;
  data: T;
}>;

type EventCursor = Readonly<{
  after: string;
  afterEventId: string;
}>;
~~~

Why use **unknown** for data? A JSON message starts as untrusted runtime input. A TypeScript type annotation does not validate bytes received over a socket. Parse the JSON, validate the envelope and event-specific payload at the boundary, then narrow the type before applying it.

### Step 2 — Make event application idempotent

~~~ts
class EventConsumer {
  private readonly seen = new Set<string>();
  private readonly lastSequenceByAggregate = new Map<string, number>();

  apply(event: RuntimeEvent): 'applied' | 'duplicate' | 'stale' | 'gap' {
    if (this.seen.has(event.eventId)) return 'duplicate';

    if (event.aggregateId && event.sequence !== undefined) {
      const previous = this.lastSequenceByAggregate.get(event.aggregateId);

      if (previous !== undefined && event.sequence <= previous) {
        return 'stale';
      }

      if (previous !== undefined && event.sequence > previous + 1) {
        return 'gap';
      }

      this.lastSequenceByAggregate.set(event.aggregateId, event.sequence);
    }

    this.seen.add(event.eventId);
    // Apply the validated domain event to the appropriate state reducer here.
    // Keep the dedupe cache bounded in production and retain a replay cursor.
    return 'applied';
  }
}
~~~

Discussion:

- A duplicate event should not apply the same transition twice.
- A gap must not be treated as an ordinary success. Trigger replay/resync and mark affected state as stale until recovery completes.
- This minimal example returns **gap** before marking the event as seen, so the caller can replay it after the missing events are recovered.
- Production code should bound the dedupe cache, validate sequence scope, persist the last durable cursor if needed, and avoid mutating the sequence map until the event is safely applied.

### Step 3 — Calculate a reconnect delay

~~~ts
function reconnectDelay(attempt: number, random = Math.random): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 16));
  const base = Math.min(30_000, 500 * 2 ** safeAttempt);
  const jitter = Math.floor(random() * Math.max(100, base * 0.25));
  return base + jitter;
}
~~~

The optional random function makes the calculation testable. For example, with **random = () => 0**, the first delay is 500 ms. With production randomness, clients spread their retry attempts over a range.

### Step 4 — Reconnect and recover, not just reconnect

Pseudocode for the owner of a stream:

~~~ts
async function onDisconnected() {
  markConnection('reconnecting');

  await wait(reconnectDelay(attempt++));

  try {
    await openTransport();
    markConnection('connected');

    // Connection restored does not imply the event history is complete.
    await replayEventsAfter(lastAppliedCursor);
    await reconcileOrRefreshSnapshotIfRequired();

    attempt = 0; // reset after successful recovery, not merely socket open
    markDataFresh();
  } catch {
    scheduleAnotherAttempt();
  }
}
~~~

This is deliberately pseudocode: **openTransport**, cursor persistence, snapshot reconciliation and cancellation depend on the selected transport and auth model. Do not paste this as a complete production client.

### Step 5 — Mini exercise

Extend the consumer with these requirements:

1. Deduplicate by **eventId**.
2. Track **sequence** per **aggregateId**, never globally.
3. When a gap occurs, stop applying dependent transitions and request replay.
4. Keep the last successfully applied cursor as **{ after, afterEventId }**.
5. Cap memory usage and define what happens on overflow.
6. Abort timers and close the transport on logout.
7. Make authentication failures trigger the existing session flow instead of an endless reconnect loop.

---

## 3. TCE architecture and real-world use case (15 minutes)

### 3.1 There are two different WebSocket uses in the current frontend

Do not confuse these channels:

1. **apps/web/lib/microfe-ws.ts** connects to the platform WebSocket at the configured NEXT_PUBLIC_WS_BASE_URL (default **wss://ws.mrcute.space/ws**). It handles platform channels such as deployment notifications. It already has heartbeat timers, resubscription after reconnect, bounded reconnect delay with jitter, a bounded recent-event dedupe set and sequence-gap callbacks.
2. The canonical TCE runtime-event transport is served by **apps/service/src/runtime-events/runtime-events.websocket.ts** at **/api/runtime/events/ws**. It is an authenticated, account-scoped, **read-only** stream of persisted TceEventEnvelope events. It must not be used to submit commands.

The runtime event stream currently polls the persisted event query every two seconds and sends batches of up to 200 events over the WebSocket. This is a pragmatic compatibility design, not a claim of instantaneous event push. Its cursor uses **occurredAt** and **eventId**; it keeps a bounded set of recently sent IDs per connection. SSE is available from **apps/service/src/runtime-events/runtime-events.controller.ts** at **/runtime/events/stream**, and REST replay is exposed by the same controller.

### 3.2 Canonical architecture

~~~text
Persisted TCE runtime events
          |
          v
RuntimeEventsQueryService
          |
          +-------------------+
          |                   |
          v                   v
REST replay             SSE / WebSocket
          |                   |
          +---------+---------+
                    |
                    v
           Authenticated client
                    |
          validate envelope/payload
                    |
          dedupe + cursor + gap check
                    |
          reducer / normalized state
                    |
          UI snapshot + freshness state
~~~

REST, SSE and WebSocket are transport adapters over the same semantic event envelope. They should not invent different domain payloads for the same event. The client derives account scope from the authenticated session; it must not trust a client-supplied account ID to choose another account.

### 3.3 Reconnect/replay scenario

Imagine the dashboard is connected and last applied:

~~~text
occurredAt   = 2026-10-28T09:00:00.000Z
afterEventId = evt-abc
~~~

Then the browser goes offline for 20 seconds.

On reconnect:

1. Re-authenticate or follow the established session-expiry flow.
2. Reconnect to the read-only stream.
3. Replay from the last successfully applied cursor using **after** and **afterEventId**.
4. Validate each envelope and payload; reject unsupported schema versions.
5. Deduplicate by stable **eventId**.
6. Apply events in the server's cursor order and check any producer-guaranteed aggregate sequence.
7. If the cursor is too old, replay fails, or a gap cannot be repaired, reload the authoritative snapshot and reconcile.
8. Mark the view fresh only after recovery succeeds.

Never advance the durable cursor just because a frame was received. Advance it after the event has been validated and successfully applied, or a reconnect can skip an event that was received but not committed to application state.

### 3.4 Backpressure policy for TCE

| Data category | Safe policy | Never do |
| --- | --- | --- |
| Display-only quote tiles | Coalesce latest value per symbol for render batching; preserve freshness timestamp | Present old quotes as current |
| Chart redraws | Batch rendering on animation frames; maintain correct candle aggregation | Drop ticks before authoritative OHLC calculation if that changes candle correctness |
| Account snapshot | Apply validated snapshot atomically or by a documented merge contract | Mix account scopes or partially apply malformed payloads |
| Execution result / reconciliation | Durable replay, idempotent reducer and server reconciliation | Drop a required transition because the UI is busy |
| Transport error / auth expiry | Mark degraded and follow session/recovery flow | Retry forever with invalid credentials |

### 3.5 Senior-level trade-offs

- **WebSocket:** useful for persistent delivery, but reconnect and recovery are application responsibilities.
- **SSE:** simpler one-way event delivery and browser-managed reconnect; auth must be compatible with EventSource or implemented with a fetch-based stream.
- **REST replay:** adds requests and cursor management but provides a recoverable history boundary.
- **Bounded dedupe cache:** controls memory; it cannot replace durable cursors or server-side replay.
- **Coalescing:** improves UI performance for replaceable display values; it is unsafe for state transitions that must all be observed.
- **Two-second polling behind WebSocket:** simplifies incremental delivery but bounds freshness and creates polling load. Changing it to true push is a separate backend design, not something a frontend should assume.

### Verification checklist

- [ ] Distinguish platform deployment WebSocket from canonical runtime-event WebSocket.
- [ ] Use the canonical envelope and event-specific runtime validation.
- [ ] Treat authentication failure differently from a transient disconnect.
- [ ] Use a durable replay cursor and dedupe by event ID.
- [ ] Scope sequence checks to the producer's documented aggregate.
- [ ] Recover detected gaps instead of silently skipping them.
- [ ] Keep memory/queues bounded and define overflow recovery.
- [ ] Never drop execution/reconciliation transitions just to keep rendering fast.
- [ ] Do not change database, trading strategy, live execution or Supabase settings for this lesson.

---

## 4. English interview practice (10 minutes)

### Question 1: What is the difference between reconnecting and resynchronizing?

**Sample answer:**

> Reconnecting restores the transport connection, but it does not prove that the client received every event produced during the outage. I use a durable cursor to replay missed events, deduplicate by event ID, and validate ordering where the producer guarantees a sequence. If replay cannot restore a consistent view, I reload an authoritative snapshot and reconcile before marking the UI fresh.

### Question 2: How would you handle high-frequency market data without losing correctness?

**Sample answer:**

> I separate domain processing from UI rendering. For display-only quote tiles, I can coalesce intermediate updates and render the latest value at a controlled frame rate. However, I would not silently drop execution, risk, or reconciliation events. Those require durable replay or an explicit recovery path. The optimization boundary must not change the underlying financial state.

### Question 3: How do you design a resilient WebSocket client?

**Sample answer:**

> I use a bounded exponential backoff with jitter, heartbeat or liveness detection where appropriate, and explicit cleanup on logout or unmount. Authentication failures follow the session flow instead of retrying forever. After reconnecting, I recover missed events through a cursor or snapshot, deduplicate messages, detect sequence gaps within the correct ordering scope, and expose connection and data freshness separately.

### Speaking drill

- Minutes 1–3: explain why a successful reconnect may still leave stale data.
- Minutes 4–6: explain when coalescing is safe and when it is data loss.
- Minutes 7–10: design a reconnect-and-replay flow for account positions and execution results.

Use this structure: **failure mode → recovery mechanism → correctness guarantee → trade-off**.

---

## 5. Review and quick quiz (5 minutes)

### Question 1

If a WebSocket reconnects successfully, can the UI immediately claim that all events are current?

**Answer:** No. It must replay from a durable cursor or resynchronize from an authoritative snapshot and reconcile.

### Question 2

Can one sequence counter be used to order all TCE events?

**Answer:** Not unless the producer explicitly guarantees a global sequence. TCE's optional sequence is scoped by its producer/aggregate contract; use the supported timestamp + event ID cursor for replay.

### Question 3

When is it safe to coalesce incoming events?

**Answer:** When intermediate values are replaceable for presentation, such as quote-tile renders, and the domain state remains correct. It is not safe to silently discard required execution, risk, account-transition or reconciliation events.

## End-of-session takeaway

A reliable realtime frontend is not just a socket with a reconnect timer. It needs a transport lifecycle, authentication policy, event identity, cursor-based recovery, ordering guarantees, bounded memory, and an explicit rule for which data can be coalesced.

Next: **Day 12 — Data normalization and cache design**, including how to merge REST snapshots and realtime events without duplicating or corrupting TCE state.
