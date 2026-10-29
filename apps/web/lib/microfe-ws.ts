'use client';

export type MicrofeEvent = {
  id: string;
  channel: string;
  event: string;
  timestamp: string;
  sequence?: number;
  data?: unknown;
};

type Options = {
  onEvent?: (event: MicrofeEvent) => void;
  onGap?: (channel: string, expected: number, received: number) => void;
  onAuthRequired?: () => void;
  /** Request an authoritative snapshot/replay after a gap or reconnect. */
  onResyncRequired?: (channel: string, reason: 'sequence-gap' | 'reconnected') => void;
};

const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'wss://ws.mrcute.space/ws';

class MicrofeWebSocket {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimeout?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private attempt = 0;
  private hasConnected = false;
  private readonly connectionGeneration = { value: 0 };
  private readonly subscriptions = new Set<string>();
  private readonly seen = new Map<string, Set<string>>();
  private readonly sequence = new Map<string, number>();
  private options: Options = {};

  start(options: Options = {}) {
    this.options = options;
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.reconnectTimer = undefined;
    this.heartbeatTimer = undefined;
    this.heartbeatTimeout = undefined;
    this.connectionGeneration.value += 1;
    this.socket?.close(1000, 'client_stop');
    this.socket = undefined;
    this.hasConnected = false;
    this.attempt = 0;
  }

  subscribe(channel: string) {
    this.subscriptions.add(channel);
    this.send({ type: 'subscribe', channel });
  }

  unsubscribe(channel: string) {
    this.subscriptions.delete(channel);
    this.send({ type: 'unsubscribe', channel });
  }

  private connect() {
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    const generation = ++this.connectionGeneration.value;
    const socket = new WebSocket(wsUrl);
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.stopped || generation !== this.connectionGeneration.value) {
        socket.close(1000, 'stale_connection');
        return;
      }
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.attempt = 0;
      this.startHeartbeat();
      for (const channel of this.subscriptions) this.send({ type: 'subscribe', channel });
      if (reconnected) {
        for (const channel of this.subscriptions) this.options.onResyncRequired?.(channel, 'reconnected');
      }
    });
    socket.addEventListener('message', event => {
      if (generation === this.connectionGeneration.value && this.socket === socket) this.handleMessage(event.data);
    });
    socket.addEventListener('close', event => {
      if (this.socket !== socket || generation !== this.connectionGeneration.value) return;
      this.socket = undefined;
      this.clearHeartbeat();
      if (event.code === 4401 || event.code === 4403) {
        this.options.onAuthRequired?.();
        return;
      }
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      if (this.socket === socket && generation === this.connectionGeneration.value) socket.close();
    });
  }

  private handleMessage(raw: unknown) {
    let message: unknown;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    const record = message as Record<string, unknown>;
    if (record.type === 'pong') {
      if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
      return;
    }
    if (record.type === 'auth_required') {
      this.options.onAuthRequired?.();
      return;
    }
    if (
      typeof record.id !== 'string' || !record.id ||
      typeof record.channel !== 'string' || !record.channel ||
      typeof record.event !== 'string' || !record.event ||
      typeof record.timestamp !== 'string' || !Number.isFinite(Date.parse(record.timestamp)) ||
      (record.sequence !== undefined && (!Number.isSafeInteger(record.sequence) || (record.sequence as number) < 0))
    ) return;

    const item: MicrofeEvent = record as unknown as MicrofeEvent;
    const seen = this.seen.get(item.channel) ?? new Set<string>();
    if (seen.has(item.id)) return;

    if (typeof item.sequence === 'number') {
      const previous = this.sequence.get(item.channel);
      if (previous != null && item.sequence > previous + 1) {
        this.options.onGap?.(item.channel, previous + 1, item.sequence);
        this.options.onResyncRequired?.(item.channel, 'sequence-gap');
        // Keep the last contiguous cursor until the owner reconciles the gap.
        return;
      }
      if (previous != null && item.sequence <= previous) return;
      this.sequence.set(item.channel, item.sequence);
    }

    seen.add(item.id);
    if (seen.size > 512) {
      const oldest = seen.values().next().value;
      if (oldest) seen.delete(oldest);
    }
    this.seen.set(item.channel, seen);
    this.options.onEvent?.(item);
  }

  private send(payload: Record<string, unknown>) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(payload));
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: new Date().toISOString() });
      if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = setTimeout(() => {
      const socket = this.socket;
      if (socket?.readyState === WebSocket.OPEN) socket.close(4000, 'heartbeat_timeout');
    }, 10000);
    }, 25000);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimer = undefined;
    this.heartbeatTimeout = undefined;
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    // Decorrelated growth with a cap prevents retry storms across clients.
    const base = Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6));
    const jitter = Math.floor(Math.random() * Math.max(100, base * 0.25));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, base + jitter);
  }
}

export const microfeWs = new MicrofeWebSocket();
