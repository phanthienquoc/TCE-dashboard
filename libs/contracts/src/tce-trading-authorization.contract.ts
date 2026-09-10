import type { ContractResult } from './errors.js';
import type { TceExecutionMode } from './tce-execution.contract.js';

export type TceTradingAuthorizationState =
  | 'READY'
  | 'EXPIRED'
  | 'APPROVAL_REQUIRED'
  | 'UNAVAILABLE';

export type TceTradingAuthorizationContext = Readonly<{
  accountId: string;
  environment: string;
  mode: TceExecutionMode;
}>;

export type TceTradingAuthorization = Readonly<{
  state: TceTradingAuthorizationState;
  provider: string;
  accountId: string;
  environment: string;
  checkedAt: string;
  expiresAt?: string;
  transactionId?: string;
}>;

export interface TceTradingAuthorizationPort {
  ensureAuthorized(
    context: TceTradingAuthorizationContext
  ): Promise<ContractResult<TceTradingAuthorization>>;
}
