import { Auth, Board, Config, Data, Stream, Trading, OrderSide, OrderType } from '@ssi.developer/ssi-sdk';
import { AccountBalance, AccountOrder, AccountPosition, BrokerOrderRequest, BrokerOrderResult, BrokerPort, ConnectInput, ContractResult, PlatformHealth, SsiAccount, SsiAuthInput, SsiConnectionPort, SsiConnectionTest, SsiCurrentInfo } from '@tce/contracts';

export type SsiTokenSnapshot = { accessToken: string; tokenType: string; expiresAt: number; refreshToken: string; refreshTokenExpiresAt: number };
export type SsiConfig = { apiKey: string; apiSecret: string; clientId?: string; privateKey?: string; accountNo?: string; token?: Partial<SsiTokenSnapshot> & { refreshExpiresAt?: number }; onTokenUpdated?: (token: SsiTokenSnapshot) => Promise<void> };
export type SsiOrderStatusEvent = { type?: string; accountNo?: string; clientRequestId?: string; orderId?: string; symbol?: string; side?: string; orderType?: string; price?: number; quantity?: number; osQuantity?: number; cancelQuantity?: number; filledQuantity?: number; status?: string; inputTime?: string; modifyTime?: string; message?: string };

export class SsiBrokerAdapter implements BrokerPort, SsiConnectionPort {
  readonly provider = 'ssi';
  private auth?: Auth;
  private tradingClient?: Trading;
  private streamClient?: Stream;
  private authenticatePromise?: Promise<ReturnType<Auth['getToken']>>;
  constructor(private readonly config: SsiConfig) {}

  private result<T>(fn: () => Promise<T>): Promise<ContractResult<T>> { return fn().then((data) => ({ ok: true, data }) as const).catch((error) => ({ ok: false, error: { code: 'PROVIDER_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false, provider: this.provider } }) as const); }

  private createAuth(includePrivateKey = true) {
    const auth = new Auth(new Config({ clientId: this.config.clientId ?? '', apiKey: this.config.apiKey, apiSecret: this.config.apiSecret, privateKey: includePrivateKey ? this.config.privateKey ?? '' : '', apiUrl: 'https://api.ssi.com.vn', streamingUrl: 'wss://stream.ssi.com.vn/ws/v3', timeout: 60000, maxRetries: 5, retryDelay: 2000, rateLimitPerSecond: 10 }));
    const token = this.config.token;
    const refreshTokenExpiresAt = Number(token?.refreshTokenExpiresAt ?? token?.refreshExpiresAt ?? 0);
    if (token?.accessToken && token.refreshToken) auth.tokenManager.setToken({ accessToken: token.accessToken, tokenType: token.tokenType ?? 'Bearer', expiresAt: Number(token.expiresAt ?? 0), refreshToken: token.refreshToken, refreshExpiresAt: refreshTokenExpiresAt });
    return auth;
  }

  private tokenSnapshot(auth: Auth = this.auth!, tokenOverride?: unknown): SsiTokenSnapshot | undefined {
    const token = tokenOverride ?? auth?.getToken(); if (!token || typeof token !== 'object') return undefined;
    const raw = token as Record<string, unknown>; const accessToken = raw.accessToken ? String(raw.accessToken) : ''; const refreshToken = raw.refreshToken ? String(raw.refreshToken) : '';
    if (!accessToken || !refreshToken) return undefined;
    return { accessToken, tokenType: String(raw.tokenType ?? 'Bearer'), expiresAt: Number(raw.expiresAt ?? 0), refreshToken, refreshTokenExpiresAt: Number(raw.refreshTokenExpiresAt ?? raw.refreshExpiresAt ?? 0) };
  }
  getTokenSnapshot() { return this.tokenSnapshot(); }
  private async persistToken(auth: Auth = this.auth!, tokenOverride?: unknown) { const token = this.tokenSnapshot(auth, tokenOverride); if (token && this.config.onTokenUpdated) await this.config.onTokenUpdated(token); return token; }

  private async authenticate(input: SsiAuthInput = {}) {
    if (this.authenticatePromise) return this.authenticatePromise;
    this.authenticatePromise = (async () => {
      this.auth ??= this.createAuth(true); const tokenManager = this.auth.tokenManager; const current = this.auth.getToken();
      if (current && !tokenManager.isTokenExpired()) { this.tradingClient ??= new Trading(this.auth); return current; }
      const currentToken = current && typeof current === 'object' ? current as Record<string, unknown> : undefined;
      const refreshTokenExpiresAt = Number(currentToken?.refreshTokenExpiresAt ?? currentToken?.refreshExpiresAt ?? 0);
      const refreshTokenValid = !refreshTokenExpiresAt || refreshTokenExpiresAt > Date.now();
      if (current && tokenManager.hasRefreshToken() && refreshTokenValid) {
        try { const refreshed = await this.auth.refresh(); this.tradingClient = new Trading(this.auth); await this.persistToken(this.auth, refreshed); return refreshed; }
        catch (error) { if (!input.otp && !input.transactionId) throw new Error(`SSI_REAUTH_REQUIRED: ${error instanceof Error ? error.message : String(error)}`); }
      }
      if (!input.otp && !input.transactionId) throw new Error('SSI_REAUTH_REQUIRED');
      const token = input.transactionId ? await this.auth.authenticate(undefined, input.transactionId) : await this.auth.authenticate(input.otp);
      this.tradingClient = new Trading(this.auth); await this.persistToken(this.auth, token); return token;
    })();
    try { return await this.authenticatePromise; } finally { this.authenticatePromise = undefined; }
  }

  private async authenticateMarketData() {
    try { await this.authenticate(); return this.auth!; }
    catch (error) { const message = error instanceof Error ? error.message : String(error); if (!message.startsWith('SSI_REAUTH_REQUIRED')) throw error; const marketAuth = this.createAuth(false); const marketToken = await marketAuth.authenticate(); await this.persistToken(marketAuth, marketToken); return marketAuth; }
  }

  async requestOtp() { return this.result(async () => { const auth = this.createAuth(true); const result = await auth.requestOtp(); const data = (result?.data ?? {}) as Record<string, unknown>; return { message: String(data.message ?? 'SSI approval/OTP request sent'), transactionId: typeof data.transactionId === 'string' ? data.transactionId : undefined }; }); }
  async connect(input: ConnectInput) { return this.result(async () => { await this.authenticate(input as SsiAuthInput); }); }
  async health(input: ConnectInput): Promise<ContractResult<PlatformHealth>> { const started = Date.now(); return this.result(async () => { if (!this.auth?.getToken() || this.auth.tokenManager.isTokenExpired()) await this.connect(input); return { provider: 'ssi', available: true, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString() }; }); }
  private async accountInfo(): Promise<SsiAccount[]> { const accounts = await this.trading().account.getAccountInfo(); return (accounts ?? []).map((account) => ({ accountNo: String(account.accountNo), accountType: String(account.accountType) })); }
  async test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>> { return this.result(async () => { const token = await this.authenticate(input); const data = new Data(this.auth!); const securities = await data.marketData.getSecuritiesInfoByBoard(Board.HOSE); const accounts = this.auth?.getToken() ? await this.accountInfo() : []; return { provider: 'ssi', apiVersion: 'v3', authentication: 'ok', marketData: 'ok', securities: securities.length, accounts, tokenExpiresAt: token?.expiresAt }; }); }
  async current(accountNo: string, input: SsiAuthInput): Promise<ContractResult<SsiCurrentInfo>> { return this.result(async () => { await this.authenticate(input); const [accounts, balance, positions, orders] = await Promise.all([this.accountInfo(), this.balance(accountNo), this.positions(accountNo), this.orders(accountNo)]); if (!balance.ok) throw new Error(balance.error.message); if (!positions.ok) throw new Error(positions.error.message); if (!orders.ok) throw new Error(orders.error.message); return { accounts, balance: balance.data, positions: positions.data, orders: orders.data, fetchedAt: new Date().toISOString() }; }); }
  private trading() { if (!this.auth) throw new Error('SSI is not connected'); return this.tradingClient!; }
  private marketData(auth: Auth) { return new Data(auth); }
  async balance(accountNo: string) { return this.result(async () => { const balance = await this.trading().portfolio.getEquityBalance(accountNo); return { cash: Number(balance?.accountBalance ?? 0), equity: Number(balance?.accountBalance ?? 0), withdrawable: Number(balance?.withdrawable ?? 0), source: 'ssi' } as AccountBalance; }); }
  async positions(accountNo: string) { return this.result(async () => { const positions = await this.trading().portfolio.getEquityPositions(accountNo); return (positions ?? []).map((position) => ({ symbol: String(position.symbol).toUpperCase(), quantity: Number(position.quantity ?? 0), averagePrice: Number(position.costPrice ?? 0), source: 'ssi' as const })) as AccountPosition[]; }); }
  async orders(accountNo: string) { return this.result(async () => { const orders = await this.trading().portfolio.getTodayOrders(accountNo); return (orders ?? []).filter((order) => order.orderId && order.symbol).map((order) => ({ externalId: String(order.orderId), symbol: String(order.symbol).toUpperCase(), side: String(order.side).toUpperCase() === 'S' ? 'SELL' as const : 'BUY' as const, quantity: Number(order.filledQuantity ?? order.quantity ?? 0), price: Number(order.avgPrice ?? order.price ?? 0), status: String(order.status ?? 'UNKNOWN'), createdAt: order.inputTime ? String(order.inputTime) : undefined, source: 'ssi' as const })) as AccountOrder[]; }); }

  async placeOrder(request: BrokerOrderRequest): Promise<ContractResult<BrokerOrderResult>> {
    return this.result(async () => {
      if (!request.accountNo) throw new Error('SSI account number is required');
      await this.authenticate();
      const result = await this.trading().order.placeOrder({ accountNo: request.accountNo, symbol: request.symbol, side: request.side === 'BUY' ? OrderSide.BUY : OrderSide.SELL, orderType: request.orderType === 'MARKET' ? OrderType.MARKET : OrderType.LIMIT, quantity: request.quantity, price: request.price, clientRequestId: request.clientRequestId });
      return { externalId: String(result?.orderId ?? ''), status: String(result?.status ?? 'SUBMITTED'), provider: 'ssi' };
    });
  }

  async cancelOrder(accountNo: string, orderId: string) { return this.result(async () => { await this.authenticate(); const result = await this.trading().order.cancelOrder(accountNo, orderId); return { externalId: orderId, status: String(result?.status ?? 'CANCEL_REQUESTED'), provider: 'ssi' }; }); }
  async accountSnapshots(input: SsiAuthInput) {
    return this.result(async () => {
      await this.authenticate(input);
      const accounts = await this.accountInfo();
      const equityAccounts = accounts.filter((account) => account.accountType === 'Cash' || account.accountType === 'Margin');
      const snapshots = await Promise.all(equityAccounts.map(async (account) => {
        const [balance, positions] = await Promise.all([this.balance(account.accountNo), this.positions(account.accountNo)]);
        if (!balance.ok) throw new Error(balance.error.message);
        if (!positions.ok) throw new Error(positions.error.message);
        return { accountNo: account.accountNo, accountType: account.accountType, balance: balance.data, positions: positions.data };
      }));
      return snapshots;
    });
  }
  async marketPrices(symbols: string[]) {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const expectedTradingDate = new Date().toISOString().slice(0, 10);
      const results: { symbol: string; price: number; tradingDate: string }[] = [];
      for (const symbol of symbols) {
        const candles = await data.marketData.getIntradayCandleData({ symbol, resolution: '15', fromDate: expectedTradingDate, toDate: expectedTradingDate });
        const candle = [...(candles ?? [])].reverse().find((item) => Number(item?.closePrice ?? 0) > 0);
        const tradingDate = this.normalizeTradingDate(candle?.tradingDate);
        const price = Number(candle?.closePrice ?? 0);
        if (!candle || price <= 0 || !tradingDate) { console.warn('[SSI_MARKET_PRICE_15M_EMPTY]', { symbol, expectedTradingDate }); continue; }
        results.push({ symbol, price, tradingDate });
      }
      return results;
    });
  }
  async dailyCloses(symbols: string[], tradingDate: string) {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const results: { symbol: string; price: number; tradingDate: string }[] = [];
      for (const symbol of symbols) {
        const candles = await data.marketData.getDailyCandleData({ symbol, fromDate: tradingDate, toDate: tradingDate });
        const candle = [...(candles ?? [])].reverse().find((item) => Number(item?.closePrice ?? 0) > 0);
        const price = Number(candle?.closePrice ?? 0);
        if (!candle || price <= 0) continue;
        results.push({ symbol, price, tradingDate: this.normalizeTradingDate(candle?.tradingDate) ?? tradingDate });
      }
      return results;
    });
  }
  private normalizeTradingDate(value: unknown) { if (!value) return undefined; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10); }
}