import { Auth, Config, Trading } from '@ssi.developer/ssi-sdk';
import { AccountBalance, AccountOrder, AccountPosition, BrokerPort, ConnectInput, ContractResult, PlatformHealth } from '@tce/contracts';

export type SsiConfig = { apiKey: string; apiSecret: string; clientId?: string; privateKey?: string; accountNo: string };

export class SsiBrokerAdapter implements BrokerPort {
  readonly provider = 'ssi';
  private auth?: Auth;
  constructor(private readonly config: SsiConfig) {}
  private result<T>(fn: () => Promise<T>): Promise<ContractResult<T>> { return fn().then((data) => ({ ok: true, data }) as const).catch((error) => ({ ok: false, error: { code: 'PROVIDER_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false, provider: this.provider } }) as const); }
  private createAuth() { return new Auth(new Config({ clientId: this.config.clientId ?? '', apiKey: this.config.apiKey, apiSecret: this.config.apiSecret, privateKey: this.config.privateKey ?? '', apiUrl: 'https://api.ssi.com.vn', streamingUrl: 'wss://stream.ssi.com.vn/ws/v3', timeout: 60000, maxRetries: 5, retryDelay: 2000, rateLimitPerSecond: 10 })); }
  async connect(_input: ConnectInput): Promise<ContractResult<void>> { return this.result(async () => { this.auth = this.createAuth(); await this.auth.authenticate(); }); }
  async health(input: ConnectInput): Promise<ContractResult<PlatformHealth>> { const started = Date.now(); return this.result(async () => { if (!this.auth) await this.connect(input); return { provider: 'ssi', available: true, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString() }; }); }
  private trading() { if (!this.auth) throw new Error('SSI is not connected'); return new Trading(this.auth); }
  async balance(accountNo: string): Promise<ContractResult<AccountBalance>> { return this.result(async () => { const b = await this.trading().portfolio.getEquityBalance(accountNo); return { cash: Number(b?.withdrawable ?? 0), equity: Number(b?.equity ?? 0), withdrawable: Number(b?.withdrawable ?? 0), source: 'ssi' }; }); }
  async positions(accountNo: string): Promise<ContractResult<AccountPosition[]>> { return this.result(async () => (await this.trading().portfolio.getEquityPositions(accountNo) ?? []).map((p) => ({ symbol: String(p.symbol).toUpperCase(), quantity: Number(p.quantity ?? 0), averagePrice: Number(p.costPrice ?? 0), source: 'ssi' })) ); }
  async orders(accountNo: string): Promise<ContractResult<AccountOrder[]>> { return this.result(async () => (await this.trading().portfolio.getTodayOrders(accountNo) ?? []).filter((o) => o.orderId && o.symbol).map((o) => ({ externalId: String(o.orderId), symbol: String(o.symbol).toUpperCase(), side: String(o.side).toUpperCase() === 'S' ? 'SELL' : 'BUY', quantity: Number(o.filledQuantity ?? o.quantity ?? 0), price: Number(o.avgPrice ?? o.price ?? 0), status: String(o.status ?? 'UNKNOWN'), createdAt: o.inputTime ? String(o.inputTime) : undefined, source: 'ssi' })) ); }
  async disconnect(_input: ConnectInput): Promise<ContractResult<void>> { this.auth = undefined; return Promise.resolve({ ok: true, data: undefined }); }
}
