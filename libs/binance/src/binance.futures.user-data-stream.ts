import { BinanceFuturesEnvironment, getBinanceFuturesUrl } from './binance.constants';

export type BinanceFuturesUserDataEvent =
  | { e: 'ACCOUNT_UPDATE'; E: number; T: number; a?: { P?: unknown[] } }
  | { e: 'ORDER_TRADE_UPDATE'; E: number; T: number; o?: Record<string, unknown> }
  | { e: 'listenKeyExpired'; E: number; listenKey: string }
  | { e: string; E?: number; [key: string]: unknown };

type Credentials = { apiKey?: string; apiSecret?: string };
type Listener = (event: BinanceFuturesUserDataEvent) => void;

/** Native USDⓈ-M Futures user-data stream using Binance listenKey streams. */
export class BinanceFuturesUserDataStream {
  private ws?: WebSocket;
  private keepalive?: ReturnType<typeof setInterval>;
  private reconnect?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private listenKey?: string;
  private readonly listeners = new Set<Listener>();
  private readonly restBase: string;
  private readonly wsBase: string;

  constructor(private readonly credentials: Credentials, private readonly environment: BinanceFuturesEnvironment = 'production') {
    this.restBase = getBinanceFuturesUrl(environment);
    this.wsBase = environment === 'testnet' ? 'wss://stream.binancefuture.com' : 'wss://fstream.binance.com';
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start() {
    this.stopped = false;
    await this.connect();
  }

  async stop() {
    this.stopped = true;
    if (this.keepalive) clearInterval(this.keepalive);
    if (this.reconnect) clearTimeout(this.reconnect);
    this.keepalive = undefined;
    this.reconnect = undefined;
    try {
      if (this.listenKey && this.credentials.apiKey)
        await fetch(`${this.restBase}/fapi/v1/listenKey`, { method: 'DELETE', headers: { 'X-MBX-APIKEY': this.credentials.apiKey } });
    } catch {
      // Do not mask application shutdown.
    }
    this.listenKey = undefined;
    this.ws?.close();
    this.ws = undefined;
  }

  private async connect() {
    if (this.stopped) return;
    if (!this.credentials.apiKey) throw new Error('Binance API key is not configured');
    const response = await fetch(`${this.restBase}/fapi/v1/listenKey`, { method: 'POST', headers: { 'X-MBX-APIKEY': this.credentials.apiKey } });
    if (!response.ok) throw new Error(`Unable to create Binance listenKey (${response.status})`);
    const data = (await response.json()) as { listenKey?: string };
    if (!data.listenKey) throw new Error('Binance did not return a listenKey');
    this.listenKey = data.listenKey;
    this.ws?.close();
    this.ws = new WebSocket(`${this.wsBase}/ws/${data.listenKey}`);
    this.ws.addEventListener('open', () => {
      if (this.keepalive) clearInterval(this.keepalive);
      this.keepalive = setInterval(() => void this.keepAlive(), 30 * 60 * 1000);
    });
    this.ws.addEventListener('message', event => {
      try {
        const parsed = JSON.parse(String(event.data)) as BinanceFuturesUserDataEvent;
        for (const listener of this.listeners) listener(parsed);
        if (parsed.e === 'listenKeyExpired') void this.reconnectNow();
      } catch {
        // Ignore malformed provider frames.
      }
    });
    this.ws.addEventListener('close', () => {
      if (!this.stopped) this.scheduleReconnect();
    });
    this.ws.addEventListener('error', () => {
      if (!this.stopped) this.scheduleReconnect();
    });
  }

  private async keepAlive() {
    if (!this.listenKey || !this.credentials.apiKey || this.stopped) return;
    const response = await fetch(`${this.restBase}/fapi/v1/listenKey`, { method: 'PUT', headers: { 'X-MBX-APIKEY': this.credentials.apiKey } });
    if (!response.ok) await this.reconnectNow();
  }

  private scheduleReconnect() {
    if (this.reconnect || this.stopped) return;
    this.reconnect = setTimeout(() => {
      this.reconnect = undefined;
      void this.reconnectNow();
    }, 1500);
  }

  private async reconnectNow() {
    if (this.stopped) return;
    try { await this.connect(); } catch { this.scheduleReconnect(); }
  }
}
