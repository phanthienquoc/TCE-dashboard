declare module '@ssi.developer/ssi-sdk' {
  interface Token {
    accessToken: string;
    tokenType: string;
    expiresAt: number;
    refreshToken: string;
    refreshTokenExpiresAt: number;
    refreshExpiresAt?: number;
  }

  interface EquityAccountBalance {
    accountNo: string;
    accountBalance?: number;
    availableCash: number;
    withdrawal: number;
    totalDebt: number;
    interestLoan: number;
    overdueFeeLoan: number;
    onHoldCash: number;
    sellUnmatched: number;
    sellT0: number;
    sellT1: number;
    sellT2: number;
    buyUnmatched: number;
    buyT0: number;
    buyT1: number;
    buyT2: number;
    advanceCashT0: number;
    advanceCashT1: number;
    holdSubscription: number;
    bankBalance: number;
    dividend: number;
    dividendMargin: number;
    blockCash: number;
    interestCash: number;
    limitT0: number;
    termDeposit: number;
  }

  interface EquityPosition {
    accountNo: string;
    symbol: string;
    quantity: number;
    costPrice: number;
    sellableQuantity: number;
    blockQuantity: number;
    dividendQuantity: number;
    buyingQuantity: number;
    boughtQuantity: number;
    sellingQuantity: number;
    soldQuantity: number;
    t1SellQuantity: number;
    t2SellQuantity: number;
    mortgageQuantity: number;
    restrictedQuantity: number;
  }

  interface Order {
    accountNo: string;
    clientRequestId?: string;
    orderId?: string;
    symbol?: string;
    side?: string;
    orderType?: string;
    price?: number;
    avgPrice?: number;
    quantity?: number;
    osQuantity?: number;
    filledQuantity?: number;
    cancelQuantity?: number;
    status?: string;
    inputTime?: string;
    modifyTime?: string;
    message?: string;
  }

  interface Account {
    accountNo: string;
    accountType: string;
  }

  class Config {
    constructor(options: Record<string, unknown>);
  }

  class Auth {
    tokenManager: {
      setToken(token: Token | Record<string, unknown>): void;
      hasRefreshToken(): boolean;
      isTokenExpired(): boolean;
    };
    constructor(config: Config | Record<string, unknown>);
    getToken(): Token | undefined;
    authenticate(otp?: string, transactionId?: string): Promise<Token>;
    refresh(): Promise<Token>;
    requestOtp(): Promise<{ data?: Record<string, unknown> }>;
  }

  class Data {
    constructor(auth: Auth);
    marketData: {
      getSecuritiesInfoByBoard(board: string): Promise<unknown[]>;
      getOhlc15Minute(symbol: string): Promise<Array<Record<string, unknown>>>;
      getOhlc1DayHistorical(symbol: string, from: string, to: string, page: number, size: number): Promise<Array<Record<string, unknown>>>;
    };
  }

  class Trading {
    constructor(auth: Auth);
    account: {
      getAccountInfo(): Promise<Account[]>;
    };
    portfolio: {
      getEquityBalance(accountNo: string): Promise<EquityAccountBalance>;
      getEquityPositions(accountNo: string): Promise<EquityPosition[]>;
      getTodayOrders(accountNo: string): Promise<Order[]>;
    };
    trading: {
      placeOrder(accountNo: string, symbol: string, side: string, quantity: number, price: number, orderType: string): Promise<Record<string, unknown>>;
    };
  }

  class Stream {
    constructor(auth: Auth);
    streaming: Record<string, unknown>;
  }

  const Board: { HOSE: string; HNX: string; UPCOM: string };
  const OrderSide: { BUY: string; SELL: string };
  const OrderType: Record<string, string>;
}
