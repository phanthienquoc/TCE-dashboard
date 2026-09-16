import type { BrokerOrderRequest, SsiAuthInput } from '@tce/contracts';
import type { SsiBrokerAdapter } from '@tce/ssi';

export interface SsiSession {
  adapter: SsiBrokerAdapter;
  accountNo: string;
}

export interface SsiFromRawParams {
  raw: Record<string, unknown>;
  userId: string;
  environment: string;
  accountNoOverride?: string;
  persistToken?: boolean;
}

export interface SsiAuthenticateReauthParams {
  userId: string;
  environment: string;
  input: SsiAuthInput;
  transactionId?: string;
}

export interface SsiTestParams {
  userId: string;
  environment: string;
  input: SsiAuthInput;
  credentials?: Record<string, unknown>;
}

export interface SsiSaveTestedParams {
  userId: string;
  environment: string;
  credentials: Record<string, unknown>;
  input: SsiAuthInput;
  accountNo: string;
}

export interface SsiMarketPricesParams {
  userId: string;
  environment: string;
  symbols: string[];
}

export interface SsiDailyClosesParams {
  userId: string;
  environment: string;
  symbols: string[];
  tradingDate: string;
}

export interface SsiDailyOhlcvParams {
  userId: string;
  environment: string;
  symbols: string[];
  fromDate: string;
  toDate: string;
}

export interface SsiPlaceOrderParams {
  userId: string;
  environment: string;
  request: Omit<BrokerOrderRequest, 'accountNo'> & { accountNo?: string };
}

export interface SsiPlaceTakeProfitParams {
  userId: string;
  environment: string;
  request: Omit<BrokerOrderRequest, 'accountNo' | 'orderType'> & { accountNo?: string };
}
