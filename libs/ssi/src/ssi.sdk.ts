import { createRequire } from 'node:module';

/** Runtime bridge for the published SSI SDK. */
const require = createRequire(import.meta.url);
const sdk = require('@ssi.developer/ssi-sdk') as SsiSdkRuntime;

type SdkRecord = Record<string, any>;
type SdkToken = SdkRecord & {
  accessToken?: string;
  tokenType?: string;
  expiresAt?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
  refreshExpiresAt?: number;
};
type SdkTokenManager = { setToken(token: SdkRecord): void; hasRefreshToken(): boolean; isTokenExpired(): boolean };
type SdkAuth = {
  tokenManager: SdkTokenManager;
  getToken(): SdkToken | undefined;
  authenticate(otp?: string, transactionId?: string): Promise<SdkToken>;
  refresh(): Promise<SdkToken>;
  requestOtp(): Promise<SdkRecord>;
};
type SdkConstructor<T> = new (...args: any[]) => T;
type SdkTrading = {
  account: { getAccountInfo(): Promise<SdkRecord[]> };
  portfolio: {
    getEquityBalance(accountNo: string): Promise<SdkRecord>;
    getEquityPositions(accountNo: string): Promise<SdkRecord[]>;
    getTodayOrders(accountNo: string): Promise<SdkRecord[]>;
  };
  trading: { placeOrder(accountNo: string, symbol: string, side: string, quantity: number, price: number, orderType: string): Promise<SdkRecord> };
};
type SdkData = { marketData: { getSecuritiesInfoByBoard(board: string): Promise<SdkRecord[]>; getOhlc15Minute(symbol: string): Promise<SdkRecord[]>; getOhlc1DayHistorical(symbol: string, from: string, to: string, page: number, size: number): Promise<SdkRecord[]> } };
type SdkStream = { streaming: SdkRecord };
type SsiSdkRuntime = {
  Auth: SdkConstructor<SdkAuth>;
  Config: SdkConstructor<SdkRecord>;
  Data: SdkConstructor<SdkData>;
  Trading: SdkConstructor<SdkTrading>;
  Stream: SdkConstructor<SdkStream>;
  Board: { HOSE: string };
  OrderSide: { BUY: string; SELL: string };
  OrderType: Record<string, string>;
};

export type Auth = SdkAuth;
export type Config = SdkRecord;
export type Data = SdkData;
export type Trading = SdkTrading;
export type Stream = SdkStream;

export const Auth = sdk.Auth;
export const Config = sdk.Config;
export const Data = sdk.Data;
export const Trading = sdk.Trading;
export const Stream = sdk.Stream;
export const Board = sdk.Board;
export const OrderSide = sdk.OrderSide;
export const OrderType = sdk.OrderType;
