import { AccountBalance, AccountOrder, AccountPosition } from './platform.contract';
import { ContractResult } from './errors.contract';

export type SsiAuthInput = { otp?: string; transactionId?: string };
export type SsiAccount = {
  accountNo: string;
  accountType: string;
  raw?: unknown;
};

export type SsiProviderAccount = SsiAccount;
export type SsiProviderBalance = AccountBalance;
export type SsiProviderPosition = AccountPosition;
export type SsiProviderOrder = AccountOrder;

export type SsiConnectionTest = {
  provider: 'ssi';
  apiVersion: 'v3';
  authentication: 'ok';
  marketData: 'ok';
  securities: number;
  accounts: SsiAccount[];
  tokenExpiresAt?: number;
};
export type SsiCurrentInfo = {
  accounts: SsiAccount[];
  balance: AccountBalance;
  positions: AccountPosition[];
  orders: AccountOrder[];
  fetchedAt: string;
};
export type SsiPortfolioSnapshot = {
  positions: AccountPosition[];
  orders: AccountOrder[];
  balance: AccountBalance;
};
export type SsiAccountSnapshot = {
  account: SsiAccount;
  balance: AccountBalance;
  positions: AccountPosition[];
};
export interface SsiConnectionPort {
  requestOtp(): Promise<ContractResult<{ transactionId?: string; message: string }>>;
  test(input: SsiAuthInput): Promise<ContractResult<SsiConnectionTest>>;
  current(accountNo: string, input: SsiAuthInput): Promise<ContractResult<SsiCurrentInfo>>;
  syncPortfolio(
    accountNo: string,
    input: SsiAuthInput
  ): Promise<ContractResult<SsiPortfolioSnapshot>>;
}
