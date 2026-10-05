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
};

const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'wss://ws.mrcute.space/ws';

class MicrofeWebSocket {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimeout?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private attempt = 0;
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
    this.socket?.close(1000, 'client_stop');
    this.socket = undefined;
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
    if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;
    this.socket = new WebSocket(wsUrl);
    this.socket.addEventListener('open', () => {
      this.attempt = 0;
      this.startHeartbeat();
      for (const channel of this.subscriptions) this.send({ type: 'subscribe', channel });
    });
    this.socket.addEventListener('message', event => this.handleMessage(event.data));
    this.socket.addEventListener('close', event => {
      this.clearHeartbeat();
      if (event.code === 4401 || event.code === 4403) {
        this.options.onAuthRequired?.();
        return;
      }
      this.scheduleReconnect();
    });
    this.socket.addEventListener('error', () => {
      this.socket?.close();
    });
  }

  private handleMessage(raw: unknown) {
    let message: any;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (message?.type === 'pong') {
      if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
      return;
    }
    if (message?.type === 'auth_required') {
      this.options.onAuthRequired?.();
      return;
    }
    if (!message?.id || !message?.channel || !message?.event) return;

    const item: MicrofeEvent = message;
    const seen = this.seen.get(item.channel) ?? new Set<string>();
    if (seen.has(item.id)) return;
    seen.add(item.id);
    if (seen.size > 512) { const oldest = seen.values().next().value; if (oldest) seen.delete(oldest); }

    if (typeof item.sequence === 'number') {
      const previous = this.sequence.get(item.channel);
      if (previous != null && item.sequence > previous + 1) {
        this.options.onGap?.(item.channel, previous + 1, item.sequence);
      }
      if (previous == null || item.sequence > previous) this.sequence.set(item.channel, item.sequence);
      if (item.sequence <= (previous ?? -1)) return;
    }

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
      this.heartbeatTimeout = setTimeout(() => this.socket?.close(4000, 'heartbeat_timeout'), 10000);
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
    const base = Math.min(30000, 500 * 2 ** this.attempt++);
    const jitter = Math.floor(Math.random() * Math.max(100, base * 0.25));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, base + jitter);
  }
}

export const microfeWs = new MicrofeWebSocket();
