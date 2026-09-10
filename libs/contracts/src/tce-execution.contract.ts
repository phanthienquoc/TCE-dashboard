import type { TceExecutionIntent, TceOrderSide } from './tce-auto-trade.contract';

export type TceExecutionOperation = 'SUBMIT' | 'CANCEL' | 'REPLACE';
export type TceExecutionMode = TceExecutionIntent['mode'];

export type TceExecutionErrorCode =
  | 'AUTHORIZATION_REQUIRED'
  | 'AUTHORIZATION_EXPIRED'
  | 'APPROVAL_REQUIRED'
  | 'INVALID_COMMAND'
  | 'INVALID_ACCOUNT'
  | 'INVALID_ORDER'
  | 'UNSUPPORTED_OPERATION'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_REJECTED'
  | 'TIMEOUT_UNKNOWN'
  | 'DUPLICATE_REQUEST'
  | 'UNKNOWN';

export type TceExecutionError = Readonly<{
  code: TceExecutionErrorCode;
  message: string;
  retryable: boolean;
  reconciliationRequired: boolean;
  providerCode?: string;
}>;

export type TceExecutionAuthorization = Readonly<{
  approvalId: string;
  approvedAt: string;
  correlationId: string;
  idempotencyKey: string;
}>;

export type TceExecutionSubmitCommand = Readonly<{
  operation: 'SUBMIT';
  accountId: string;
  environment: string;
  mode: TceExecutionMode;
  authorization: TceExecutionAuthorization;
  intent: TceExecutionIntent;
  clientRequestId: string;
}>;

export type TceExecutionCancelCommand = Readonly<{
  operation: 'CANCEL';
  accountId: string;
  environment: string;
  mode: TceExecutionMode;
  authorization: TceExecutionAuthorization;
  executionIntentId: string;
  providerOrderId?: string;
  clientRequestId: string;
}>;

export type TceExecutionReplaceCommand = Readonly<{
  operation: 'REPLACE';
  accountId: string;
  environment: string;
  mode: TceExecutionMode;
  authorization: TceExecutionAuthorization;
  executionIntentId: string;
  providerOrderId: string;
  clientRequestId: string;
  quantity?: number;
  limitPrice?: number;
}>;

export type TceExecutionCommand =
  TceExecutionSubmitCommand | TceExecutionCancelCommand | TceExecutionReplaceCommand;

export type TceExecutionResultStatus =
  'SUBMITTED' | 'CANCELLED' | 'REPLACED' | 'PENDING' | 'REJECTED' | 'UNKNOWN';

export type TceExecutionResult = Readonly<{
  ok: boolean;
  operation: TceExecutionOperation;
  status: TceExecutionResultStatus;
  executionIntentId: string;
  correlationId: string;
  idempotencyKey: string;
  providerOrderId?: string;
  clientRequestId: string;
  filledQuantity?: number;
  providerStatus?: string;
  error?: TceExecutionError;
}>;

export type TceExecutionOrderSnapshot = Readonly<{
  providerOrderId?: string;
  clientRequestId?: string;
  executionIntentId: string;
  symbol: string;
  side: TceOrderSide;
  quantity: number;
  filledQuantity: number;
  status: string;
}>;

export interface TceExecutionPort {
  submit(command: TceExecutionSubmitCommand): Promise<TceExecutionResult>;
  cancel(command: TceExecutionCancelCommand): Promise<TceExecutionResult>;
  replace(command: TceExecutionReplaceCommand): Promise<TceExecutionResult>;
}
