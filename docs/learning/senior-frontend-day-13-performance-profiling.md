# Senior Frontend Day 13 — Performance Profiling and React Rendering

> Duration: 60 minutes. This lesson continues Day 12's normalized-state and cache design. It is documentation-only: it does not change runtime behavior, market-data handling, Supabase schema, trading strategy, or execution settings.

## Learning objectives

By the end of this session, you should be able to:

- Measure before optimizing and distinguish a slow render from slow network, parsing, or layout work.
- Use React DevTools Profiler and browser Performance tools to identify the actual bottleneck.
- Explain how state ownership, selector identity, and component boundaries affect rerenders.
- Optimize long lists and high-frequency quote updates without hiding stale or missing data.
- Choose memoization only when measurement shows a useful benefit.
- Verify an optimization with repeatable before/after measurements.

## Minute plan

| Time      | Activity                    | Outcome                                                        |
| --------- | --------------------------- | -------------------------------------------------------------- |
| 0–10 min  | Performance fundamentals    | Separate user-perceived latency from CPU/render cost           |
| 10–25 min | Profiling workflow          | Capture and interpret a reproducible profile                   |
| 25–40 min | React rendering practice    | Reduce unnecessary work without changing behavior              |
| 40–50 min | TCE architecture            | Apply profiling to quote tiles, positions, and dashboard lists |
| 50–60 min | Interview practice and quiz | Explain evidence, trade-offs, and regression checks            |

---

## 1. Fundamentals — measure the right thing (10 minutes)

### 1.1 “Slow UI” is a symptom, not a diagnosis

A page can feel slow for different reasons:

| Symptom                                         | Likely area to inspect                                    | Evidence to collect                                          |
| ----------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Initial screen appears late                     | Network, server response, JS download/parse, hydration    | Network waterfall, route timing, browser Performance trace   |
| Clicking feels delayed                          | Main-thread work, expensive calculation, event handler    | Long tasks and call stacks in Performance                    |
| Scrolling stutters                              | Large DOM, repeated layout, expensive row rendering       | Frame track, layout/paint events, list size                  |
| One quote update rerenders the whole dashboard  | Broad state subscription or unstable props                | React Profiler commit and component render counts            |
| UI looks current but data is old                | Cache/realtime recovery, not necessarily rendering        | Event cursor, freshness timestamp, snapshot/version evidence |
| Repeated rerenders do not show a visible change | State identity, selector result identity, parent rerender | React Profiler and component props/state                     |

Do not reach for memoization, virtualization, or a new state library before identifying which work is expensive.

### 1.2 Performance has multiple layers

Think about the complete path:

    Request / event
       -> parse and validate payload
       -> normalize and update state
       -> select data for a component
       -> React render
       -> DOM commit
       -> browser style / layout / paint
       -> visible result

Optimizing one stage does not automatically optimize the others. For example, memoizing a React component will not make an API response arrive sooner, fix a stale cache, or reduce expensive JSON parsing that happens before rendering.

### 1.3 Establish a baseline

Before changing code, record:

- The exact route and user action.
- Device/browser and whether the profile is a development or production build.
- Dataset size and relevant state (for example, number of watchlist symbols).
- What “slow” means: interaction latency, load time, dropped frames, or excessive commits.
- A repeatable measurement and the current result.

Use the same scenario after the change. Development Strict Mode may invoke render-related work more than once; do not treat a development-only render count as a production performance measurement.

---

## 2. Profiling workflow (15 minutes)

### 2.1 React DevTools Profiler

Use the Profiler to answer:

1. Which interaction produced a commit?
2. Which components rendered during that commit?
3. Which components consumed the most render time?
4. Did a component render because its own state changed, its parent rendered, its props changed, or a subscribed value changed?
5. Is the expensive work repeated often enough to matter?

A component rendering is not inherently a defect. A render can be cheap, and React may need to render to determine whether the committed output changes. Focus on expensive or frequent work tied to a real user-facing symptom.

### 2.2 Browser Performance panel

Record the interaction in the browser's Performance panel. Inspect:

- **Main thread:** long JavaScript tasks and their call stacks.
- **Scripting:** event handlers, parsing, reducers, selectors, and render work.
- **Rendering:** style recalculation, layout, and paint.
- **Network:** whether waiting on the server dominates the total delay.
- **Frames:** missed frame deadlines during scrolling or live updates.

A long task (roughly 50 ms or more on the main thread) can block input and painting. It is a useful signal, not a universal target for every function.

### 2.3 Repeatable before/after experiment

Use this checklist for each optimization:

1. Reproduce the same interaction and dataset.
2. Record a baseline trace or profile.
3. Identify one suspected bottleneck from the evidence.
4. Make one focused change.
5. Repeat the same interaction under comparable conditions.
6. Compare duration, long tasks, commit counts, and visible behavior.
7. Keep the change only if it improves the target without correctness or maintainability regressions.

Avoid comparing a cold initial load with a warm cached load, or a production profile with a development profile, as if they were equivalent.

---

## 3. React rendering and state boundaries (15 minutes)

### 3.1 State ownership controls update scope

If every quote update is written to a broad store slice that the entire dashboard subscribes to, many components may rerender even when they do not use the changed quote.

Prefer subscriptions that select the smallest useful value. With Zustand, for example:

    // Broad subscription: observes the entire quotes map.
    const quotes = useMarketStore((state) => state.quotes);

    // Narrow subscription: observes one quote.
    const quote = useMarketStore((state) => state.quotesByKey[quoteKey]);

The exact selector depends on the current store contract. Do not rename or reshape production state just to match this illustrative snippet. If a selector creates a new object or array on every call, it may defeat referential equality; use a stable selector result or the repository's supported shallow-equality pattern when appropriate.

### 3.2 Component boundaries

A useful boundary isolates frequently updated content from relatively static layout:

    DashboardShell
      ├── Navigation
      ├── PortfolioSummary
      └── Watchlist
           ├── QuoteRow(DPM)  <- DPM quote update
           ├── QuoteRow(SSI)
           └── QuoteRow(GAS)

A DPM update should not force unrelated rows to perform expensive work if the state and component boundaries can avoid it. Verify this in the Profiler rather than assuming the component tree guarantees it.

### 3.3 Memoization is conditional

- **React.memo** can skip rendering when props compare equal, but it adds comparison and mental overhead.
- **useMemo** can avoid recalculating an expensive derived value when dependencies are stable; it is not a correctness mechanism.
- **useCallback** can preserve function identity for consumers that benefit from stable references; wrapping every function is not automatically useful.
- **Derived state** should usually be calculated from its source of truth instead of copied into another state variable that can drift.

Memoization is only helpful when the avoided work exceeds the comparison, allocation, and maintenance cost. Keep dependencies correct; a stale closure is a correctness bug, not a performance win.

### 3.4 Lists and virtualization

For a large list, consider:

- Stable entity keys, never array indices for reorderable entities.
- Avoiding duplicated per-row entity objects when normalized state already provides canonical entities.
- Pagination or virtualization when the number of mounted rows is the measured bottleneck.
- Keeping row heights and accessibility behavior predictable.
- Preserving sorting, focus, selection, and keyboard behavior after virtualization.

Virtualization adds complexity and can affect accessibility and browser find behavior. Do not add it to a small list without evidence that DOM size or row work is the bottleneck.

---

## 4. TCE-specific performance and correctness (10 minutes)

### 4.1 High-frequency market updates

For quote tiles, the rendering layer may coalesce presentation updates when intermediate values are replaceable and the canonical market state remains correct. That does **not** authorize dropping events required for positions, risk, execution, audit, or reconciliation.

Keep these concerns separate:

- **Transport correctness:** did the consumer recover missed events and detect gaps?
- **Domain correctness:** did the state reducer apply the right event/version?
- **Rendering efficiency:** how often did React commit visible changes?
- **Freshness UX:** can the user distinguish current, stale, and unavailable data?

A lower render count is not a success if the UI now displays a stale quote or silently skips an important state transition.

### 4.2 Profile a real dashboard scenario

Use a safe, deterministic dataset or mocked events; do not submit live orders or alter production trading settings.

Suggested scenario:

1. Open the overview with a known number of watchlist symbols and positions.
2. Capture a baseline while applying a deterministic sequence of quote updates.
3. Inspect whether an update to one symbol rerenders unrelated rows and summary components.
4. Record React commit duration and main-thread long tasks.
5. If evidence points to broad subscriptions, narrow the selector or isolate the frequently updated row.
6. Replay the same event sequence and compare results.
7. Confirm the latest quote, freshness marker, ordering, and all required domain events remain correct.

### 4.3 Performance acceptance checklist

- [ ] The reported bottleneck is supported by a reproducible profile or trace.
- [ ] Before/after measurements use the same scenario and comparable build/browser conditions.
- [ ] State subscriptions are no broader than needed for the component's output.
- [ ] Lists use stable entity keys and preserve ordering/interaction behavior.
- [ ] Memoization has a measured purpose and correct dependencies.
- [ ] No stale closure, stale cache, or event-loss regression is introduced.
- [ ] Account/environment scope and existing authentication/API contracts remain unchanged.
- [ ] No runtime, Supabase, strategy, schedule, or live-execution settings are changed by this lesson.

---

## 5. English interview practice (5 minutes)

### Question 1: How do you diagnose a slow React page?

**Sample answer:**

> I first define the user-visible symptom and reproduce it with a representative dataset. I use the browser Performance panel to separate network waiting, main-thread JavaScript, layout, and paint. Then I use React Profiler to find expensive or unnecessary component work. I change one likely cause, repeat the same scenario, and compare the results. I avoid adding memoization before I have evidence that rendering is the bottleneck.

### Question 2: When would you use React.memo, useMemo, or useCallback?

**Sample answer:**

> I use them when profiling shows repeated work that can be skipped and when the relevant props or dependencies have stable identity. React.memo can skip a component render when its props are equal; useMemo can cache an expensive calculation; and useCallback can stabilize a function reference for a consumer that benefits from it. They add complexity and do not replace correct state ownership or data consistency.

### Question 3: How do you optimize a realtime dashboard without losing correctness?

**Sample answer:**

> I separate event recovery and domain-state correctness from rendering frequency. I preserve durable cursors, ordering, deduplication, and reconciliation for important events. For presentation-only quote tiles, I may coalesce renders while keeping the canonical state correct. I verify both performance and data correctness with the same deterministic event sequence.

Speaking structure: **symptom → measurement → bottleneck → focused change → verified trade-off**.

---

## 6. Review and quick quiz (5 minutes)

### Question 1

The whole dashboard rerenders when DPM changes, but the page feels smooth. Is this automatically a bug?

**Answer:** No. Rendering is not itself a defect. Profile the actual cost and user-visible symptom before deciding whether optimization is warranted.

### Question 2

Will useMemo make a slow network request faster?

**Answer:** No. It may avoid recalculating a derived value during rendering; it does not reduce network latency or validate server data.

### Question 3

A profile shows fewer React commits after coalescing quote updates. What else must be verified?

**Answer:** Confirm the canonical state remains correct, important events are not lost, freshness and ordering remain valid, and positions/execution/risk/reconciliation events are not silently dropped.

## End-of-session takeaway

Measure first, identify the slow layer, make one focused change, and measure again. Good frontend performance preserves the same data correctness, accessibility, and user-visible behavior while reducing unnecessary work.

Next: **Day 14 — Frontend testing strategy**, focusing on choosing unit, component, integration, and end-to-end tests for asynchronous state, API errors, realtime recovery, and accessible UI behavior.
