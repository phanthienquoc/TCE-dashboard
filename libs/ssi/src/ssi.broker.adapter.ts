import { Auth, Board, Config, Data, Stream, Trading } from '@ssi.developer/ssi-sdk';
import { AccountBalance, AccountOrder, AccountPosition, BrokerPort, ConnectInput, ContractResult, PlatformHealth, SsiAccount, SsiAuthInput, SsiConnectionPort, SsiConnectionTest, SsiCurrentInfo } from '@tce/contracts';

export type SsiTokenSnapshot = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
};

export type SsiConfig = {
  apiKey: string;
  apiSecret: string;
  clientId?: string;
  privateKey?: string;
  accountNo?: string;
  token?: Partial<SsiTokenSnapshot>;
  onTokenUpdated?: (token: SsiTokenSnapshot) => Promise<void>;
};

export type SsiOrderStatusEvent = { type?: string; accountNo?: string; clientRequestId?: string; orderId?: string; symbol?: string; side?: string; orderType?: string; price?: number; quantity?: number; osQuantity?: number; cancelQuantity?: number; filledQuantity?: number; status?: string; inputTime?: string; modifyTime?: string; message?: string };

export class SsiBrokerAdapter implements BrokerPort, SsiConnectionPort {
  readonly provider = 'ssi';
  private auth?: Auth;
  private tradingClient?: Trading;
  private streamClient?: Stream;
  private authenticatePromise?: Promise<ReturnType<Auth['getToken']>>;

  constructor(private readonly config: SsiConfig) {}

  private result<T>(fn: () => Promise<T>): Promise<ContractResult<T>> {
    return fn()
      .then((data) => ({ ok: true, data }) as const)
      .catch((error) => ({ ok: false, error: { code: 'PROVIDER_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false, provider: this.provider } }) as const);
  }

  private createAuth(includePrivateKey = true) {
    const auth = new Auth(new Config({
      clientId: this.config.clientId ?? '',
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      privateKey: includePrivateKey ? this.config.privateKey ?? '' : '',
      apiUrl: 'https://api.ssi.com.vn',
      streamingUrl: 'wss://stream.ssi.com.vn/ws/v3',
      timeout: 60000,
      maxRetries: 5,
      retryDelay: 2000,
      rateLimitPerSecond: 10,
    }));

    const token = this.config.token;
    if (token?.accessToken && token.refreshToken) {
      auth.tokenManager.setToken({
        accessToken: token.accessToken,
        tokenType: token.tokenType ?? 'Bearer',
        expiresAt: Number(token.expiresAt ?? 0),
        refreshToken: token.refreshToken,
        refreshExpiresAt: Number(token.refreshExpiresAt ?? 0),
      });
    }
    return auth;
  }

  private tokenSnapshot(auth: Auth = this.auth!, tokenOverride?: unknown): SsiTokenSnapshot | undefined {
    const token = tokenOverride ?? auth?.getToken();
    if (!token || typeof token !== 'object') return undefined;
    const raw = token as Record<string, unknown>;
    const accessToken = raw.accessToken ? String(raw.accessToken) : '';
    const refreshToken = raw.refreshToken ? String(raw.refreshToken) : '';
    if (!accessToken || !refreshToken) return undefined;
    return {
      accessToken,
      tokenType: String(raw.tokenType ?? 'Bearer'),
      expiresAt: Number(raw.expiresAt ?? 0),
      refreshToken,
      refreshExpiresAt: Number(raw.refreshExpiresAt ?? raw.refreshTokenExpiresAt ?? 0),
    };
  }

  getTokenSnapshot() { return this.tokenSnapshot(); }

  private async persistToken(auth: Auth = this.auth!, tokenOverride?: unknown) {
    const token = this.tokenSnapshot(auth, tokenOverride);
    if (token && this.config.onTokenUpdated) await this.config.onTokenUpdated(token);
    return token;
  }

  private async authenticate(input: SsiAuthInput = {}) {
    if (this.authenticatePromise) return this.authenticatePromise;

    this.authenticatePromise = (async () => {
      this.auth ??= this.createAuth(true);
      const tokenManager = this.auth.tokenManager;
      const current = this.auth.getToken();

      if (current && !tokenManager.isTokenExpired()) {
        this.tradingClient ??= new Trading(this.auth);
        return current;
      }

      if (current && tokenManager.hasRefreshToken()) {
        try {
          const refreshed = await this.auth.refresh();
          this.tradingClient = new Trading(this.auth);
          await this.persistToken(this.auth, refreshed);
          return refreshed;
        } catch (error) {
          if (!input.otp && !input.transactionId) {
            throw new Error(`SSI_REAUTH_REQUIRED: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      if (!input.otp && !input.transactionId) throw new Error('SSI_REAUTH_REQUIRED');
      const token = input.transactionId
        ? await this.auth.authenticate(undefined, input.transactionId)
        : await this.auth.authenticate(input.otp);
      this.tradingClient = new Trading(this.auth);
      await this.persistToken(this.auth, token);
      return token;
    })();

    try { return await this.authenticatePromise; }
    finally { this.authenticatePromise = undefined; }
  }

  private async authenticateMarketData() {
    try {
      await this.authenticate();
      return this.auth!;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith('SSI_REAUTH_REQUIRED')) throw error;
      const marketAuth = this.createAuth(false);
      const marketToken = await marketAuth.authenticate();
      await this.persistToken(marketAuth, marketToken);
      return marketAuth;
    }
  }

  async requestOtp() {
    return this.result(async () => {
      const auth = this.createAuth(true);
      const result = await auth.requestOtp();
      const data = (result?.data ?? {}) as Record<string, unknown>;
      return { message: String(data.message ?? 'SSI approval/OTP request sent'), transactionId: typeof data.transactionId === 'string' ? data.transactionId : undefined };
    });
  }

  async connect(input: ConnectInput) { return this.result(async () => { await this.authenticate(input as SsiAuthInput); }); }

  async health(input: ConnectInput): Promise<ContractResult<PlatformHealth>> {
    const started = Date.now();
    return this.result(async () => {
      if (!this.auth?.getToken() || this.auth.tokenManager.isTokenExpired()) await this.connect(input);
      return { provider: 'ssi', available: true, latencyMs: Date.now() - started, fetchedAt: new Date().toISOString() };
    });
  }

  private async accountInfo(): Promise<SsiAccount[]> {
    const accounts = await this.trading().account.getAccountInfo();
    return (accounts ?? []).map((account) => ({ accountNo: String(account.accountNo), accountType: String(account.accountType) }));
  }

  async test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>> {
    return this.result(async () => {
      const token = await this.authenticate(input);
      const data = new Data(this.auth!);
      const securities = await data.marketData.getSecuritiesInfoByBoard(Board.HOSE);
      const accounts = this.auth?.getToken() ? await this.accountInfo() : [];
      return { provider: 'ssi', apiVersion: 'v3', authentication: 'ok', marketData: 'ok', securities: securities.length, accounts, tokenExpiresAt: token?.expiresAt };
    });
  }

  async current(accountNo: string, input: SsiAuthInput): Promise<ContractResult<SsiCurrentInfo>> {
    return this.result(async () => {
      await this.authenticate(input);
      const [accounts, balance, positions, orders] = await Promise.all([this.accountInfo(), this.balance(accountNo), this.positions(accountNo), this.orders(accountNo)]);
      if (!balance.ok) throw new Error(balance.error.message);
      if (!positions.ok) throw new Error(positions.error.message);
      if (!orders.ok) throw new Error(orders.error.message);
      return { accounts, balance: balance.data, positions: positions.data, orders: orders.data, fetchedAt: new Date().toISOString() };
    });
  }

  private trading() { if (!this.auth) throw new Error('SSI is not connected'); return this.tradingClient!; }
  private marketData(auth: Auth) { return new Data(auth); }

  async balance(accountNo: string) {
    return this.result(async () => {
      const balance = await this.trading().portfolio.getEquityBalance(accountNo);
      return { cash: Number(balance?.accountBalance ?? 0), equity: Number(balance?.accountBalance ?? 0), withdrawable: Number(balance?.withdrawable ?? 0), source: 'ssi' } as AccountBalance;
    });
  }

  async positions(accountNo: string) {
    return this.result(async () => {
      const positions = await this.trading().portfolio.getEquityPositions(accountNo);
      return (positions ?? []).map((position) => ({ symbol: String(position.symbol).toUpperCase(), quantity: Number(position.quantity ?? 0), averagePrice: Number(position.costPrice ?? 0), source: 'ssi' as const })) as AccountPosition[];
    });
  }

  async orders(accountNo: string) {
    return this.result(async () => {
      const orders = await this.trading().portfolio.getTodayOrders(accountNo);
      return (orders ?? []).filter((order) => order.orderId && order.symbol).map((order) => ({ externalId: String(order.orderId), symbol: String(order.symbol).toUpperCase(), side: String(order.side).toUpperCase() === 'S' ? 'SELL' as const : 'BUY' as const, quantity: Number(order.filledQuantity ?? order.quantity ?? 0), price: Number(order.avgPrice ?? order.price ?? 0), status: String(order.status ?? 'UNKNOWN'), createdAt: order.inputTime ? String(order.inputTime) : undefined, source: 'ssi' as const })) as AccountOrder[];
    });
  }

  private latestDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

  private normalizeTradingDate(value: unknown) {
    const normalized = String(value ?? '').slice(0, 10).replaceAll('/', '-');
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  }

  private isCurrentTradingDate(value: unknown) {
    return this.normalizeTradingDate(value) === this.latestDate();
  }

  async marketPrices(symbols: string[]): Promise<ContractResult<Array<{ symbol: string; price: number; tradingDate: string }>>> {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const results: Array<{ symbol: string; price: number; tradingDate: string }> = [];
      const expectedTradingDate = this.latestDate();
      for (const rawSymbol of symbols) {
        const symbol = String(rawSymbol).trim().toUpperCase();
        if (!symbol) continue;
        const candles = await data.marketData.getOhlc1Minute(symbol);
        const candle = candles?.at(-1);
        const tradingDate = this.normalizeTradingDate(candle?.tradingDate);
        const price = Number(candle?.closePrice ?? 0);
        if (!candle || price <= 0) {
          console.warn('[SSI_MARKET_PRICE_EMPTY]', { symbol, expectedTradingDate });
          continue;
        }
        if (tradingDate !== expectedTradingDate) {
          console.warn('[SSI_MARKET_PRICE_STALE]', { symbol, price, tradingDate, expectedTradingDate });
          continue;
        }
        results.push({ symbol, price, tradingDate });
      }
      return results;
    });
  }

  async dailyCloses(symbols: string[], tradingDate: string): Promise<ContractResult<Array<{ symbol: string; closePrice: number }>>> {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const from = `${tradingDate.replaceAll('-', '/')} 00:00:00`;
      const to = `${tradingDate.replaceAll('-', '/')} 23:59:59`;
      const results: Array<{ symbol: string; closePrice: number }> = [];
      for (const rawSymbol of symbols) {
        const symbol = String(rawSymbol).trim().toUpperCase();
        if (!symbol) continue;
        const candles = await data.marketData.getOhlc1DayHistorical(symbol, from, to, 1, 10);
        const candle = candles?.at(-1);
        if (!candle || Number(candle.closePrice ?? 0) <= 0) continue;
        results.push({ symbol, closePrice: Number(candle.closePrice) });
      }
      return results;
    });
  }

  async accountSnapshots(input: SsiAuthInput): Promise<ContractResult<Array<{ account: SsiAccount; balance: AccountBalance; positions: AccountPosition[] }>>> {
    return this.result(async () => {
      await this.authenticate(input);
      const accounts = await this.accountInfo();
      const snapshots = await Promise.all(accounts.map(async (account) => {
        const [balance, positions] = await Promise.all([this.balance(account.accountNo), this.positions(account.accountNo)]);
        if (!balance.ok) throw new Error(`${account.accountNo}: ${balance.error.message}`);
        if (!positions.ok) throw new Error(`${account.accountNo}: ${positions.error.message}`);
        return { account, balance: balance.data, positions: positions.data };
      }));
      return snapshots;
    });
  }

  async syncPortfolio(accountNo: string, input: SsiAuthInput) {
    const authResult = await this.result(() => this.authenticate(input).then(() => undefined));
    if (!authResult.ok) return authResult;
    const [balance, positions, orders] = await Promise.all([this.balance(accountNo), this.positions(accountNo), this.orders(accountNo)]);
    if (!balance.ok) return { ok: false, error: balance.error } as const;
    if (!positions.ok) return { ok: false, error: positions.error } as const;
    if (!orders.ok) return { ok: false, error: orders.error } as const;
    return { ok: true, data: { positions: positions.data.filter((position) => position.quantity > 0), orders: orders.data.filter((order) => order.quantity > 0), balance: balance.data } } as const;
  }

  async startOrderStatusStream(accountNo: string, onEvent: (event: SsiOrderStatusEvent) => void) {
    await this.authenticate();
    if (this.streamClient) return;
    this.streamClient = new Stream(this.auth!);
    this.streamClient.streaming.onTrading = (message) => {
      const event = message as unknown as SsiOrderStatusEvent;
      if (event.type === 'orderEvent' && (!accountNo || !event.accountNo || event.accountNo === accountNo)) onEvent(event);
    };
    await this.streamClient.streaming.connect();
    this.streamClient.streaming.subscribeOrderStatus(accountNo);
    this.streamClient.streaming.ping(undefined, 30000);
  }

  async stopOrderStatusStream() { this.streamClient?.streaming.disconnect(); this.streamClient = undefined; }

  async disconnect(_input: ConnectInput) {
    await this.stopOrderStatusStream();
    this.auth = undefined;
    this.tradingClient = undefined;
    this.authenticatePromise = undefined;
    return { ok: true, data: undefined } as const;
  }
}
