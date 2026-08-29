import {
  Auth,
  Board,
  Config,
  Data,
  Stream,
  Trading,
  OrderSide,
  OrderType,
} from '@ssi.developer/ssi-sdk';
import {
  AccountBalance,
  AccountOrder,
  AccountPosition,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerPort,
  ConnectInput,
  ContractResult,
  PlatformHealth,
  SsiAccount,
  SsiAuthInput,
  SsiConnectionPort,
  SsiConnectionTest,
  SsiCurrentInfo,
} from '@tce/contracts';

export type SsiTokenSnapshot = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
};
export type SsiConfig = {
  apiKey: string;
  apiSecret: string;
  clientId?: string;
  privateKey?: string;
  accountNo?: string;
  token?: Partial<SsiTokenSnapshot> & { refreshExpiresAt?: number };
  onTokenUpdated?: (token: SsiTokenSnapshot) => Promise<void>;
};
export type SsiOrderStatusEvent = {
  type?: string;
  accountNo?: string;
  clientRequestId?: string;
  orderId?: string;
  symbol?: string;
  side?: string;
  orderType?: string;
  price?: number;
  quantity?: number;
  osQuantity?: number;
  cancelQuantity?: number;
  filledQuantity?: number;
  status?: string;
  inputTime?: string;
  modifyTime?: string;
  message?: string;
};

export class SsiBrokerAdapter implements BrokerPort, SsiConnectionPort {
  readonly provider = 'ssi';
  private auth?: Auth;
  private tradingClient?: Trading;
  private streamClient?: Stream;
  private authenticatePromise?: Promise<ReturnType<Auth['getToken']>>;
  constructor(private readonly config: SsiConfig) {}

  private providerError(error: unknown) {
    const candidate = error as Record<string, unknown> | null;
    const response = candidate?.response as Record<string, unknown> | undefined;
    const data = response?.data ?? candidate?.data;
    const status = response?.status ?? candidate?.status ?? candidate?.statusCode;
    const message = error instanceof Error ? error.message : String(error);
    const detail = data != null ? `; response=${JSON.stringify(data)}` : '';
    return `${status ? `HTTP ${status}: ` : ''}${message}${detail}`;
  }

  private result<T>(fn: () => Promise<T>): Promise<ContractResult<T>> {
    return fn()
      .then(data => ({ ok: true, data }) as const)
      .catch(
        error =>
          ({
            ok: false,
            error: {
              code: 'PROVIDER_ERROR',
              message: this.providerError(error),
              retryable: false,
              provider: this.provider,
            },
          }) as const
      );
  }

  private createAuth(includePrivateKey = true) {
    if (!this.config.apiKey || !this.config.apiSecret)
      throw new Error('SSI apiKey/apiSecret are required');
    const auth = new Auth(
      new Config({
        clientId: this.config.clientId ?? '',
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        privateKey: includePrivateKey ? (this.config.privateKey ?? '') : '',
        apiUrl: 'https://api.ssi.com.vn',
        streamingUrl: 'wss://stream.ssi.com.vn/ws/v3',
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
        rateLimitPerSecond: 10,
      })
    );
    const token = this.config.token;
    const refreshTokenExpiresAt = Number(
      token?.refreshTokenExpiresAt ?? token?.refreshExpiresAt ?? 0
    );
    if (token?.accessToken && token.refreshToken)
      auth.tokenManager.setToken({
        accessToken: token.accessToken,
        tokenType: token.tokenType ?? 'Bearer',
        expiresAt: Number(token.expiresAt ?? 0),
        refreshToken: token.refreshToken,
        refreshExpiresAt: refreshTokenExpiresAt,
      });
    return auth;
  }

  private tokenSnapshot(
    auth: Auth = this.auth!,
    tokenOverride?: unknown
  ): SsiTokenSnapshot | undefined {
    const token = tokenOverride ?? auth?.getToken();
    if (!token || typeof token !== 'object') return undefined;
    const raw = token as unknown as Record<string, unknown>;
    const accessToken = raw.accessToken ? String(raw.accessToken) : '';
    const refreshToken = raw.refreshToken ? String(raw.refreshToken) : '';
    if (!accessToken || !refreshToken) return undefined;
    return {
      accessToken,
      tokenType: String(raw.tokenType ?? 'Bearer'),
      expiresAt: Number(raw.expiresAt ?? 0),
      refreshToken,
      refreshTokenExpiresAt: Number(raw.refreshTokenExpiresAt ?? raw.refreshExpiresAt ?? 0),
    };
  }
  getTokenSnapshot() {
    return this.tokenSnapshot();
  }
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
      const currentToken =
        current && typeof current === 'object'
          ? (current as unknown as Record<string, unknown>)
          : undefined;
      const refreshTokenExpiresAt = Number(
        currentToken?.refreshTokenExpiresAt ?? currentToken?.refreshExpiresAt ?? 0
      );
      const refreshTokenValid = !refreshTokenExpiresAt || refreshTokenExpiresAt > Date.now();
      if (current && tokenManager.hasRefreshToken() && refreshTokenValid) {
        try {
          const refreshed = await this.auth.refresh();
          this.tradingClient = new Trading(this.auth);
          await this.persistToken(this.auth, refreshed);
          return refreshed;
        } catch (error) {
          if (!input.otp && !input.transactionId)
            throw new Error(`SSI_REAUTH_REQUIRED: ${this.providerError(error)}`);
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
    try {
      return await this.authenticatePromise;
    } finally {
      this.authenticatePromise = undefined;
    }
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
      return {
        message: String(data.message ?? 'SSI approval/OTP request sent'),
        transactionId: typeof data.transactionId === 'string' ? data.transactionId : undefined,
      };
    });
  }
  async connect(input: ConnectInput) {
    return this.result(async () => {
      await this.authenticate(input as SsiAuthInput);
    });
  }
  async health(input: ConnectInput): Promise<ContractResult<PlatformHealth>> {
    const started = Date.now();
    return this.result(async () => {
      if (!this.auth?.getToken() || this.auth.tokenManager.isTokenExpired())
        await this.connect(input);
      return {
        provider: 'ssi',
        available: true,
        latencyMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
      };
    });
  }

  private async accountInfo(): Promise<SsiAccount[]> {
    const accounts = await this.trading().account.getAccountInfo();
    return (accounts ?? []).map(account => ({
      accountNo: String(account.accountNo),
      accountType: String(account.accountType),
      raw: account,
    }));
  }

  async test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>> {
    return this.result(async () => {
      const token = await this.authenticate(input);
      const data = new Data(this.auth!);
      const securities = await data.marketData.getSecuritiesInfoByBoard(Board.HOSE);
      const accounts = this.auth?.getToken() ? await this.accountInfo() : [];
      return {
        provider: 'ssi',
        apiVersion: 'v3',
        authentication: 'ok',
        marketData: 'ok',
        securities: securities.length,
        accounts,
        tokenExpiresAt: token?.expiresAt,
      };
    });
  }
  async current(accountNo: string, input: SsiAuthInput): Promise<ContractResult<SsiCurrentInfo>> {
    return this.result(async () => {
      await this.authenticate(input);
      let balance = await this.balance(accountNo);
      if (!balance.ok) {
        const fallback = await this.marginBalance(accountNo);
        if (fallback.ok) balance = fallback;
      }
      const [accounts, positions, orders] = await Promise.all([
        this.accountInfo(),
        this.positions(accountNo),
        this.orders(accountNo),
      ]);
      if (!balance.ok) throw new Error(balance.error.message);
      if (!positions.ok) throw new Error(positions.error.message);
      if (!orders.ok) throw new Error(orders.error.message);
      return {
        accounts,
        balance: balance.data,
        positions: positions.data,
        orders: orders.data,
        fetchedAt: new Date().toISOString(),
      };
    });
  }
  private trading() {
    if (!this.auth) throw new Error('SSI is not connected');
    return this.tradingClient!;
  }
  private marketData(auth: Auth) {
    return new Data(auth);
  }

  async balance(accountNo: string) {
    return this.result(async () => {
      const balance = await this.trading().portfolio.getEquityBalance(accountNo);
      return {
        accountNo: String(balance?.accountNo ?? accountNo),
        cash: Number(balance?.accountBalance ?? balance?.availableCash ?? 0),
        equity: Number(balance?.accountBalance ?? 0),
        withdrawable: Number(balance?.withdrawal ?? balance?.withdrawable ?? 0),
        availableCash: Number(balance?.availableCash ?? balance?.accountBalance ?? 0),
        totalDebt: Number(balance?.totalDebt ?? 0),
        interestLoan: Number(balance?.interestLoan ?? 0),
        overdueFeeLoan: Number(balance?.overdueFeeLoan ?? 0),
        onHoldCash: Number(balance?.onHoldCash ?? 0),
        sellUnmatched: Number(balance?.sellUnmatched ?? 0),
        sellT0: Number(balance?.sellT0 ?? 0),
        sellT1: Number(balance?.sellT1 ?? 0),
        sellT2: Number(balance?.sellT2 ?? 0),
        buyUnmatched: Number(balance?.buyUnmatched ?? 0),
        buyT0: Number(balance?.buyT0 ?? 0),
        buyT1: Number(balance?.buyT1 ?? 0),
        buyT2: Number(balance?.buyT2 ?? 0),
        advanceCashT0: Number(balance?.advanceCashT0 ?? 0),
        advanceCashT1: Number(balance?.advanceCashT1 ?? 0),
        holdSubscription: Number(balance?.holdSubscription ?? 0),
        bankBalance: Number(balance?.bankBalance ?? 0),
        dividend: Number(balance?.dividend ?? 0),
        dividendMargin: Number(balance?.dividendMargin ?? 0),
        blockCash: Number(balance?.blockCash ?? 0),
        interestCash: Number(balance?.interestCash ?? 0),
        limitT0: Number(balance?.limitT0 ?? 0),
        termDeposit: Number(balance?.termDeposit ?? 0),
        source: 'ssi' as const,
        raw: balance,
      } as AccountBalance;
    });
  }

  async positions(accountNo: string) {
    return this.result(async () => {
      if (!this.config.clientId?.trim())
        throw new Error(
          'SSI_CLIENT_ID_REQUIRED_FOR_PORTFOLIO: clientId is required by SSI for equity positions'
        );
      const normalizedAccountNo = accountNo.trim();
      if (!normalizedAccountNo) throw new Error('SSI account number is required for positions');
      const positions = await this.trading().portfolio.getEquityPositions(normalizedAccountNo);
      return (positions ?? []).map(position => ({
        accountNo: String(position.accountNo ?? normalizedAccountNo),
        symbol: String(position.symbol).toUpperCase(),
        quantity: Number(position.quantity ?? 0),
        averagePrice: Number(position.costPrice ?? 0),
        sellableQuantity: Number(position.sellableQuantity ?? 0),
        blockQuantity: Number(position.blockQuantity ?? 0),
        dividendQuantity: Number(position.dividendQuantity ?? 0),
        buyingQuantity: Number(position.buyingQuantity ?? 0),
        boughtQuantity: Number(position.boughtQuantity ?? 0),
        sellingQuantity: Number(position.sellingQuantity ?? 0),
        soldQuantity: Number(position.soldQuantity ?? 0),
        t1SellQuantity: Number(position.t1SellQuantity ?? 0),
        t2SellQuantity: Number(position.t2SellQuantity ?? 0),
        mortgageQuantity: Number(position.mortgageQuantity ?? 0),
        restrictedQuantity: Number(position.restrictedQuantity ?? 0),
        source: 'ssi' as const,
        raw: position,
      })) as AccountPosition[];
    });
  }

  async orders(accountNo: string) {
    return this.result(async () => {
      const orders = await this.trading().portfolio.getTodayOrders(accountNo);
      return (orders ?? [])
        .filter(order => order.orderId && order.symbol)
        .map(order => ({
          accountNo: String(order.accountNo ?? accountNo),
          externalId: String(order.orderId),
          clientRequestId: order.clientRequestId ? String(order.clientRequestId) : undefined,
          symbol: String(order.symbol).toUpperCase(),
          side: String(order.side).toUpperCase() === 'S' ? ('SELL' as const) : ('BUY' as const),
          orderType: order.orderType ? String(order.orderType) : undefined,
          quantity: Number(order.quantity ?? 0),
          osQuantity: Number(order.osQuantity ?? 0),
          filledQuantity: Number(order.filledQuantity ?? 0),
          cancelQuantity: Number(order.cancelQuantity ?? 0),
          price: Number(order.price ?? 0),
          avgPrice: Number(order.avgPrice ?? 0),
          status: String(order.status ?? 'UNKNOWN'),
          createdAt: order.inputTime ? String(order.inputTime) : undefined,
          modifyTime: order.modifyTime ? String(order.modifyTime) : undefined,
          message: order.message ? String(order.message) : undefined,
          source: 'ssi' as const,
          raw: order,
        })) as AccountOrder[];
    });
  }

  async placeOrder(request: BrokerOrderRequest): Promise<ContractResult<BrokerOrderResult>> {
    return this.result(async () => {
      if (!request.accountNo) throw new Error('SSI account number is required');
      if (!request.symbol) throw new Error('Order symbol is required');
      if (!Number.isInteger(request.quantity) || request.quantity <= 0)
        throw new Error('Order quantity must be a positive integer');
      if (
        request.orderType === 'LO' &&
        (!Number.isFinite(request.price) || Number(request.price) <= 0)
      )
        throw new Error('LO order requires a positive price');
      await this.authenticate();
      const trading = this.trading().trading;
      const side = request.side === 'SELL' ? OrderSide.SELL : OrderSide.BUY;
      const type = OrderType[request.orderType as keyof typeof OrderType];
      if (!type) throw new Error(`Unsupported SSI order type: ${request.orderType}`);
      const clientRequestId =
        request.clientRequestId ?? String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
      const result = await trading.placeOrder(
        request.accountNo,
        request.symbol.toUpperCase(),
        side,
        request.quantity,
        Number(request.price ?? 0),
        type
      );
      return {
        orderId: result.orderId ? String(result.orderId) : undefined,
        clientRequestId: result.clientRequestId ? String(result.clientRequestId) : clientRequestId,
        status: String(result.status ?? 'UNKNOWN'),
      };
    });
  }

  private latestDate() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
  private normalizeTradingDate(value: unknown) {
    const normalized = String(value ?? '')
      .slice(0, 10)
      .replaceAll('/', '-');
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  }

  async marketPrices(
    symbols: string[]
  ): Promise<ContractResult<Array<{ symbol: string; price: number; tradingDate: string }>>> {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const results: Array<{ symbol: string; price: number; tradingDate: string }> = [];
      const expectedTradingDate = this.latestDate();
      for (const rawSymbol of symbols) {
        const symbol = String(rawSymbol).trim().toUpperCase();
        if (!symbol) continue;
        const candles = await data.marketData.getOhlc15Minute(symbol);
        const candle = [...(candles ?? [])]
          .reverse()
          .find(item => Number(item?.closePrice ?? 0) > 0);
        const tradingDate = this.normalizeTradingDate(candle?.tradingDate);
        const price = Number(candle?.closePrice ?? 0);
        if (!candle || price <= 0 || !tradingDate) {
          console.warn('[SSI_MARKET_PRICE_15M_EMPTY]', { symbol, expectedTradingDate });
          continue;
        }
        results.push({ symbol, price, tradingDate });
      }
      return results;
    });
  }

  async dailyCloses(
    symbols: string[],
    tradingDate: string
  ): Promise<ContractResult<Array<{ symbol: string; closePrice: number }>>> {
    return this.result(async () => {
      const auth = await this.authenticateMarketData();
      const data = this.marketData(auth);
      const results: Array<{ symbol: string; closePrice: number }> = [];
      for (const rawSymbol of symbols) {
        const symbol = String(rawSymbol).trim().toUpperCase();
        if (!symbol) continue;
        const from = `${tradingDate.replaceAll('-', '/')} 00:00:00`;
        const to = `${tradingDate.replaceAll('-', '/')} 23:59:59`;
        const candles = await data.marketData.getOhlc1DayHistorical(symbol, from, to, 1, 10);
        const candle = candles?.at(-1);
        if (!candle || Number(candle.closePrice ?? 0) <= 0) continue;
        results.push({ symbol, closePrice: Number(candle.closePrice) });
      }
      return results;
    });
  }

  private async marginBalance(accountNo: string): Promise<ContractResult<AccountBalance>> {
    return this.result(async () => {
      const ppmmr = await this.trading().portfolio.getEquityPpmmr(accountNo);
      return {
        accountNo: String(ppmmr?.accountNo ?? accountNo),
        cash: Number(ppmmr?.withdrawable ?? 0),
        equity: Number(ppmmr?.eeOrigin ?? 0),
        withdrawable: Number(ppmmr?.withdrawable ?? 0),
        availableCash: Number(ppmmr?.purchasingPower ?? ppmmr?.withdrawable ?? 0),
        totalDebt: Number(ppmmr?.totalDebt ?? ppmmr?.debt ?? 0),
        interestLoan: Number(ppmmr?.interestSsi ?? 0),
        overdueFeeLoan: 0,
        onHoldCash: 0,
        sellUnmatched: Number(ppmmr?.sellUnmatched ?? 0),
        sellT0: Number(ppmmr?.sellT0 ?? 0),
        sellT1: Number(ppmmr?.sellT1 ?? 0),
        sellT2: Number(ppmmr?.sellT2 ?? 0),
        buyUnmatched: Number(ppmmr?.buyUnmatched ?? 0),
        buyT0: Number(ppmmr?.buyT0 ?? 0),
        buyT1: Number(ppmmr?.buyT1 ?? 0),
        buyT2: Number(ppmmr?.buyT2 ?? 0),
        advanceCashT0: 0,
        advanceCashT1: 0,
        holdSubscription: 0,
        bankBalance: 0,
        dividend: Number(ppmmr?.dividend ?? 0),
        dividendMargin: Number(ppmmr?.dividend ?? 0),
        blockCash: 0,
        interestCash: 0,
        limitT0: Number(ppmmr?.creditLimit ?? 0),
        termDeposit: 0,
        source: 'ssi' as const,
        raw: ppmmr,
      } as AccountBalance;
    });
  }

  async accountSnapshots(
    input: SsiAuthInput
  ): Promise<
    ContractResult<
      Array<{ account: SsiAccount; balance: AccountBalance; positions: AccountPosition[] }>
    >
  > {
    return this.result(async () => {
      await this.authenticate(input);
      const accounts = await this.accountInfo();
      const equityAccounts = accounts.filter(account => {
        const type = String(account.accountType ?? '')
          .trim()
          .toUpperCase();
        return (
          type === 'EQUITY' || type === 'EQUITY_MARGIN' || type === 'CASH' || type === 'MARGIN'
        );
      });
      if (!equityAccounts.length)
        throw new Error(
          `SSI_EQUITY_ACCOUNTS_NOT_FOUND: ${accounts.map(account => `${account.accountNo}:${account.accountType}`).join(', ') || 'no accounts returned'}`
        );

      const snapshots: Array<{
        account: SsiAccount;
        balance: AccountBalance;
        positions: AccountPosition[];
      }> = [];
      const failures: string[] = [];
      for (const account of equityAccounts) {
        const type = String(account.accountType ?? '')
          .trim()
          .toUpperCase();
        const positions = await this.positions(account.accountNo);
        if (!positions.ok) {
          failures.push(
            `${account.accountNo} (${account.accountType}) positions: ${positions.error.message}`
          );
          continue;
        }

        let balance = await this.balance(account.accountNo);
        if (!balance.ok && (type === 'MARGIN' || type === 'EQUITY_MARGIN')) {
          console.warn('[SSI_MARGIN_BALANCE_FALLBACK]', {
            accountNo: account.accountNo,
            accountType: account.accountType,
            error: balance.error.message,
          });
          balance = await this.marginBalance(account.accountNo);
        }
        if (!balance.ok) {
          failures.push(
            `${account.accountNo} (${account.accountType}) balance: ${balance.error.message}`
          );
          continue;
        }
        snapshots.push({ account, balance: balance.data, positions: positions.data });
      }

      if (!snapshots.length) throw new Error(`SSI_EQUITY_SNAPSHOTS_FAILED: ${failures.join('; ')}`);
      if (failures.length) console.warn('[SSI_PARTIAL_PORTFOLIO_SYNC]', { failures });
      return snapshots;
    });
  }
  async syncPortfolio(accountNo: string, input: SsiAuthInput) {
    const authResult = await this.result(() => this.authenticate(input).then(() => undefined));
    if (!authResult.ok) return authResult;
    let balance = await this.balance(accountNo);
    if (!balance.ok) {
      const fallback = await this.marginBalance(accountNo);
      if (fallback.ok) balance = fallback;
    }
    const [positions, orders] = await Promise.all([
      this.positions(accountNo),
      this.orders(accountNo),
    ]);
    if (!balance.ok) return { ok: false, error: balance.error } as const;
    if (!positions.ok) return { ok: false, error: positions.error } as const;
    if (!orders.ok) return { ok: false, error: orders.error } as const;
    return {
      ok: true,
      data: {
        positions: positions.data.filter(position => position.quantity > 0),
        orders: orders.data.filter(order => order.quantity > 0),
        balance: balance.data,
      },
    } as const;
  }
  async startOrderStatusStream(accountNo: string, onEvent: (event: SsiOrderStatusEvent) => void) {
    await this.authenticate();
    if (this.streamClient) return;
    this.streamClient = new Stream(this.auth!);
    this.streamClient.streaming.onTrading = message => {
      const event = message as unknown as SsiOrderStatusEvent;
      if (
        event.type === 'orderEvent' &&
        (!accountNo || !event.accountNo || event.accountNo === accountNo)
      )
        onEvent(event);
    };
    await this.streamClient.streaming.connect();
    this.streamClient.streaming.subscribeOrderStatus(accountNo);
    this.streamClient.streaming.ping(undefined, 30000);
  }
  async stopOrderStatusStream() {
    this.streamClient?.streaming.disconnect();
    this.streamClient = undefined;
  }
  async disconnect(_input: ConnectInput) {
    await this.stopOrderStatusStream();
    this.auth = undefined;
    this.tradingClient = undefined;
    this.authenticatePromise = undefined;
    return { ok: true, data: undefined } as const;
  }
}
