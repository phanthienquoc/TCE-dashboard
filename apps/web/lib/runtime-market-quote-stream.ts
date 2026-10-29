import { isTceRuntimeEvent, type TceRuntimeEvent } from '@tce/contracts/tce-event.contract';
import type { MarketQuote } from '@tce/contracts/platform.contract';
import { api } from './api';

type QuoteEvent = TceRuntimeEvent<'market.quote.updated'>;
type Cursor = { occurredAt: string; eventId: string };
type Options = {
  accountId: string;
  onQuote: (event: QuoteEvent) => void | Promise<void>;
  onAuthRequired: () => void;
  onRecoveryRequired?: (reason: string) => void;
};

const EVENT_TYPE = 'market.quote.updated';
const BATCH_SIZE = 200;
const MAX_REPLAY_PAGES = 5;
const MAX_PENDING_EVENTS = 500;
const MAX_SEEN_IDS = 1024;
const RECONNECT_CAP_MS = 30_000;

function cursorKey(accountId: string): string {
  return `tce:runtime-events:${encodeURIComponent(accountId)}:${EVENT_TYPE}:cursor`;
}

function readCursor(accountId: string): Cursor | null {
  try {
    const raw = localStorage.getItem(cursorKey(accountId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Cursor>;
    if (
      typeof value.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(value.occurredAt)) ||
      typeof value.eventId !== 'string' ||
      !value.eventId
    )
      return null;
    return { occurredAt: value.occurredAt, eventId: value.eventId };
  } catch {
    return null;
  }
}

function writeCursor(accountId: string, cursor: Cursor): void {
  try {
    localStorage.setItem(cursorKey(accountId), JSON.stringify(cursor));
  } catch {
    // Replay remains safe for the current connection; persistence is best-effort.
  }
}

function compareCursor(a: Cursor, b: Cursor): number {
  const time = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
  if (time !== 0) return time;
  return a.eventId.localeCompare(b.eventId);
}

function websocketUrl(): URL {
  const baseUrl = new URL(api.defaults.baseURL ?? '/api', window.location.origin);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/runtime/events/ws`;
  baseUrl.search = '';
  baseUrl.hash = '';
  baseUrl.searchParams.set('eventType', EVENT_TYPE);
  return baseUrl;
}

function responseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

/**
 * Consumer for the canonical persisted TCE runtime event stream.
 *
 * This client intentionally subscribes only to market.quote.updated because
 * the dashboard currently has an authoritative quote reducer, but does not yet
 * have reducers for execution/account/strategy events. Cursor persistence occurs
 * only after the consumer has successfully applied a validated quote.
 */
export class RuntimeMarketQuoteStream {
  private started = false;
  private halted = false;
  private generation = 0;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private requestController: AbortController | null = null;
  private cursor: Cursor | null = null;
  private readonly pending: unknown[] = [];
  private draining = false;
  private replaying = false;
  private readonly seenIds = new Set<string>();
  private readonly aggregateSequences = new Map<string, number>();

  constructor(private readonly options: Options) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.halted = false;
    this.generation += 1;
    this.cursor = readCursor(this.options.accountId);
    void this.connect(this.generation);
  }

  stop(): void {
    this.started = false;
    this.halted = false;
    this.generation += 1;
    this.clearTimers();
    this.requestController?.abort();
    this.requestController = null;
    const socket = this.socket;
    this.socket = null;
    this.pending.length = 0;
    this.seenIds.clear();
    this.aggregateSequences.clear();
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, 'client_stop');
    }
  }

  private isCurrent(generation: number): boolean {
    return this.started && !this.halted && generation === this.generation;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.reconnectTimer = null;
    this.stableTimer = null;
  }

  private async connect(generation: number): Promise<void> {
    if (!this.isCurrent(generation)) return;

    const controller = new AbortController();
    this.requestController = controller;
    try {
      // Uses the existing Axios session/refresh flow; never put tokens in a URL.
      await api.get('/runtime/events', {
        params: { limit: 1, eventType: EVENT_TYPE },
        signal: controller.signal,
      });
    } catch (error) {
      if (!this.isCurrent(generation) || controller.signal.aborted) return;
      if (responseStatus(error) === 401) {
        this.options.onAuthRequired();
        this.stop();
      } else {
        this.scheduleReconnect(generation);
      }
      return;
    } finally {
      if (this.requestController === controller) this.requestController = null;
    }

    if (!this.isCurrent(generation)) return;
    let url: URL;
    try {
      url = websocketUrl();
    } catch {
      this.halt('invalid-websocket-url');
      return;
    }
    if (this.cursor) {
      url.searchParams.set('after', this.cursor.occurredAt);
      url.searchParams.set('afterEventId', this.cursor.eventId);
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(url.toString());
    } catch {
      this.scheduleReconnect(generation);
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (!this.isCurrent(generation) || this.socket !== socket) {
        socket.close(1000, 'stale_connection');
        return;
      }
      if (this.stableTimer) clearTimeout(this.stableTimer);
      this.stableTimer = setTimeout(() => {
        if (this.isCurrent(generation) && this.socket === socket) this.retryAttempt = 0;
      }, 15_000);
    });
    socket.addEventListener('message', event => {
      if (!this.isCurrent(generation) || this.socket !== socket) return;
      if (this.pending.length >= MAX_PENDING_EVENTS) {
        // Do not advance the cursor. Reconnecting replays from the last applied event.
        this.pending.length = 0;
        socket.close(4008, 'consumer_backpressure_replay');
        return;
      }
      this.pending.push(event.data);
      void this.drain(generation, socket);
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.stableTimer) clearTimeout(this.stableTimer);
      this.stableTimer = null;
      this.pending.length = 0;
      if (this.isCurrent(generation)) this.scheduleReconnect(generation);
    });
    socket.addEventListener('error', () => {
      if (this.socket === socket && socket.readyState < WebSocket.CLOSING) socket.close();
    });
  }

  private scheduleReconnect(generation: number): void {
    if (!this.isCurrent(generation) || this.reconnectTimer) return;
    const base = Math.min(RECONNECT_CAP_MS, 500 * 2 ** Math.min(this.retryAttempt++, 6));
    const delay = base + Math.floor(Math.random() * Math.max(100, base * 0.25));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect(generation);
    }, delay);
  }

  private halt(reason: string): void {
    this.halted = true;
    this.clearTimers();
    this.options.onRecoveryRequired?.(reason);
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1011, 'recovery_required');
  }

  private async drain(generation: number, socket: WebSocket): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length && this.isCurrent(generation) && this.socket === socket) {
        const raw = this.pending.shift();
        let value: unknown;
        try {
          value = JSON.parse(String(raw));
        } catch {
          continue;
        }
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          (value as Record<string, unknown>).type === 'transport.error'
        ) {
          // The server failed to read durable storage; retry through its cursor.
          socket.close(1011, 'runtime_event_store_unavailable');
          return;
        }
        if (!isTceRuntimeEvent(value) || value.eventType !== EVENT_TYPE) continue;
        const event = value as QuoteEvent;
        if (event.accountId && event.accountId !== this.options.accountId) continue;
        if (this.seenIds.has(event.eventId)) continue;
        const nextCursor = { occurredAt: event.occurredAt, eventId: event.eventId };
        if (this.cursor && compareCursor(nextCursor, this.cursor) <= 0) continue;

        if (this.hasSequenceGap(event)) {
          const cursorBeforeReplay = this.cursor;
          await this.replayFromCursor(generation);
          if (!this.isCurrent(generation)) return;
          if (this.cursor === cursorBeforeReplay || this.hasSequenceGap(event)) {
            this.halt('sequence-gap-unresolved-by-replay');
            return;
          }
          continue;
        }
        try {
          await this.options.onQuote(event);
          if (!this.isCurrent(generation) || this.socket !== socket) return;
        } catch {
          // Leave the durable cursor behind and replay rather than skipping an event.
          this.options.onRecoveryRequired?.('quote-apply-failed');
          socket.close(1011, 'quote_apply_failed');
          return;
        }
        this.commit(event);
      }
    } finally {
      this.draining = false;
    }
  }

  private hasSequenceGap(event: QuoteEvent): boolean {
    if (!event.aggregateId || event.sequence === undefined) return false;
    const key = `${event.producer}:${event.aggregateId}`;
    const previous = this.aggregateSequences.get(key);
    return previous !== undefined && event.sequence > previous + 1;
  }

  private commit(event: QuoteEvent): void {
    const cursor = { occurredAt: event.occurredAt, eventId: event.eventId };
    this.cursor = cursor;
    writeCursor(this.options.accountId, cursor);
    if (event.aggregateId && event.sequence !== undefined) {
      this.aggregateSequences.set(`${event.producer}:${event.aggregateId}`, event.sequence);
    }
    this.seenIds.add(event.eventId);
    if (this.seenIds.size > MAX_SEEN_IDS) {
      const oldest = this.seenIds.values().next().value;
      if (oldest) this.seenIds.delete(oldest);
    }
  }

  private async replayFromCursor(generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.replaying || !this.cursor) return;
    this.replaying = true;
    const controller = new AbortController();
    this.requestController = controller;
    try {
      for (let page = 0; page < MAX_REPLAY_PAGES; page += 1) {
        if (!this.isCurrent(generation) || controller.signal.aborted || !this.cursor) return;
        const response = await api.get<{
          ok?: boolean;
          data?: unknown[];
        }>('/runtime/events', {
          params: {
            after: this.cursor.occurredAt,
            afterEventId: this.cursor.eventId,
            limit: BATCH_SIZE,
            eventType: EVENT_TYPE,
          },
          signal: controller.signal,
        });
        const batch = Array.isArray(response.data?.data) ? response.data.data : [];
        if (!batch.length) return;
        for (const value of batch) {
          if (!isTceRuntimeEvent(value) || value.eventType !== EVENT_TYPE) continue;
          const event = value as QuoteEvent;
          if (event.accountId && event.accountId !== this.options.accountId) continue;
          if (this.seenIds.has(event.eventId)) continue;
          if (
            this.cursor &&
            compareCursor({ occurredAt: event.occurredAt, eventId: event.eventId }, this.cursor) <=
              0
          )
            continue;
          if (this.hasSequenceGap(event)) {
            this.halt('sequence-gap-unresolved-by-replay');
            return;
          }
          await this.options.onQuote(event);
          if (!this.isCurrent(generation) || controller.signal.aborted) return;
          this.commit(event);
        }
        if (batch.length < BATCH_SIZE) return;
      }
      this.halt('replay-budget-exceeded');
    } catch (error) {
      if (!this.isCurrent(generation) || controller.signal.aborted) return;
      if (responseStatus(error) === 401) {
        this.options.onAuthRequired();
        this.stop();
      } else {
        this.options.onRecoveryRequired?.('replay-request-failed');
        this.socket?.close(1011, 'replay_request_failed');
      }
    } finally {
      if (this.requestController === controller) this.requestController = null;
      this.replaying = false;
    }
  }
}
