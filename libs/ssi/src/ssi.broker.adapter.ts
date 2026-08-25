import { Auth, Board, Config, Data, Stream, Trading } from '@ssi.developer/ssi-sdk';
import { AccountBalance, AccountOrder, AccountPosition, BrokerPort, ConnectInput, ContractResult, PlatformHealth, SsiAccount, SsiAuthInput, SsiConnectionPort, SsiConnectionTest, SsiCurrentInfo } from '@tce/contracts';

export type SsiConfig = { apiKey: string; apiSecret: string; clientId?: string; privateKey?: string; accountNo: string };
export type SsiOrderStatusEvent = {
  type?: string; accountNo?: string; clientRequestId?: string; orderId?: string; symbol?: string; side?: string; orderType?: string;
  price?: number; quantity?: number; osQuantity?: number; filledQuantity?: number; cancelQuantity?: number; status?: string;
  inputTime?: string; modifyTime?: string; message?: string;
};

export class SsiBrokerAdapter implements BrokerPort, SsiConnectionPort {
  readonly provider = 'ssi';
  private auth?: Auth;
  private tradingClient?: Trading;
  private streamClient?: Stream;
  constructor(private readonly config: SsiConfig) {}
  private result<T>(fn: () => Promise<T>): Promise<ContractResult<T>> { return fn().then((data) => ({ ok: true, data }) as const).catch((error) => ({ ok: false, error: { code: 'PROVIDER_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false, provider: this.provider } }) as const); }
  private createAuth() { return new Auth(new Config({ clientId: this.config.clientId ?? '', apiKey: this.config.apiKey, apiSecret: this.config.apiSecret, privateKey: this.config.privateKey ?? '', apiUrl: 'https://api.ssi.com.vn', streamingUrl: 'wss://stream.ssi.com.vn/ws/v3', timeout: 60000, maxRetries: 5, retryDelay: 2000, rateLimitPerSecond: 10 })); }
  private async authenticate(input: SsiAuthInput = {}) { this.auth ??= this.createAuth(); if (this.auth.getToken()) { this.tradingClient ??= new Trading(this.auth); return this.auth.getToken(); } const token = input.transactionId ? await this.auth.authenticate(undefined, input.transactionId) : await this.auth.authenticate(input.otp); this.tradingClient = new Trading(this.auth); return token; }
  async requestOtp() { return this.result(async () => { const auth = this.createAuth(); const result = await auth.requestOtp(); const data = (result?.data ?? {}) as Record<string, unknown>; return { message: String(data.message ?? 'SSI approval/OTP request sent'), transactionId: typeof data.transactionId === 'string' ? data.transactionId : undefined }; }); }
  async connect(input: ConnectInput) { return this.result(async () => { await this.authenticate(input as SsiAuthInput); }); }
  async health(input: ConnectInput): Promise<ContractResult<PlatformHealth>> { const started = Date.now(); return this.result(async () => { if (!this.auth?.getToken()) await this.connect(input); return { provider: 'ssi', available: true, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString() }; }); }
  private async accountInfo(): Promise<SsiAccount[]> { const accounts = await this.trading().account.getAccountInfo(); return (accounts ?? []).map((account) => ({ accountNo: String(account.accountNo), accountType: String(account.accountType) })); }
  async test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>> { return this.result(async () => { const token = await this.authenticate(input); const data = new Data(this.auth!); const securities = await data.marketData.getSecuritiesInfoByBoard(Board.HOSE); const accounts = await this.accountInfo(); return { provider: 'ssi', apiVersion: 'v3', authentication: 'ok', marketData: 'ok', securities: securities.length, accounts, tokenExpiresAt: token?.expiresAt }; }); }
  async current(accountNo: string, input: SsiAuthInput): Promise<ContractResult<SsiCurrentInfo>> { return this.result(async () => { await this.authenticate(input); const [accounts, balance, positions, orders] = await Promise.all([this.accountInfo(), this.balance(accountNo), this.positions(accountNo), this.orders(accountNo)]); if (!balance.ok) throw new Error(balance.error.message); if (!positions.ok) throw new Error(positions.error.message); if (!orders.ok) throw new Error(orders.error.message); return { accounts, balance: balance.data, positions: positions.data, orders: orders.data, fetchedAt: new Date().toISOString() }; }); }
  private trading() { if (!this.tradingClient) throw new Error('SSI is not connected'); return this.tradingClient; }
  async balance(accountNo: string) { return this.result(async () => { const balance = await this.trading().portfolio.getEquityBalance(accountNo); return { cash: Number(balance?.accountBalance ?? 0), equity: Number(balance?.accountBalance ?? 0), withdrawable: Number(balance?.withdrawable ?? 0), source: 'ssi' } as AccountBalance; }); }
  async positions(accountNo: string) { return this.result(async () => { const positions = await this.trading().portfolio.getEquityPositions(accountNo); return (positions ?? []).map((position) => ({ symbol: String(position.symbol).toUpperCase(), quantity: Number(position.quantity ?? 0), averagePrice: Number(position.costPrice ?? 0), source: 'ssi' as const })) as AccountPosition[]; }); }
  async orders(accountNo: string) { return this.result(async () => { const orders = await this.trading().portfolio.getTodayOrders(accountNo); return (orders ?? []).filter((order) => order.orderId && order.symbol).map((order) => ({ externalId: String(order.orderId), symbol: String(order.symbol).toUpperCase(), side: String(order.side).toUpperCase() === 'S' ? 'SELL' as const : 'BUY' as const, quantity: Number(order.filledQuantity ?? order.quantity ?? 0), price: Number(order.avgPrice ?? order.price ?? 0), status: String(order.status ?? 'UNKNOWN'), createdAt: order.inputTime ? String(order.inputTime) : undefined, source: 'ssi' as const })) as AccountOrder[]; }); }
  async syncPortfolio(accountNo: string, input: SsiAuthInput) { const authResult = await this.result(() => this.authenticate(input).then(() => undefined)); if (!authResult.ok) return authResult; const [balance, positions, orders] = await Promise.all([this.balance(accountNo), this.positions(accountNo), this.orders(accountNo)]); if (!balance.ok) return { ok: false, error: balance.error } as const; if (!positions.ok) return { ok: false, error: positions.error } as const; if (!orders.ok) return { ok: false, error: orders.error } as const; return { ok: true, data: { positions: positions.data.filter((position) => position.quantity > 0), orders: orders.data.filter((order) => order.quantity > 0), balance: balance.data } } as const; }
  async startOrderStatusStream(accountNo: string, onEvent: (event: SsiOrderStatusEvent) => void) {
    await this.authenticate();
    if (this.streamClient) return;
    this.streamClient = new Stream(this.auth!);
    this.streamClient.streaming.onTrading = (message) => { const event = message as unknown as SsiOrderStatusEvent; if (event.type === 'orderEvent' && (!accountNo || !event.accountNo || event.accountNo === accountNo)) onEvent(event); };
    await this.streamClient.streaming.connect();
    this.streamClient.streaming.subscribeOrderStatus(accountNo);
    this.streamClient.streaming.ping(undefined, 30000);
  }
  async stopOrderStatusStream() { this.streamClient?.streaming.disconnect(); this.streamClient = undefined; }
  async disconnect(_input: ConnectInput) { await this.stopOrderStatusStream(); this.auth = undefined; this.tradingClient = undefined; return { ok: true, data: undefined } as const; }
}
