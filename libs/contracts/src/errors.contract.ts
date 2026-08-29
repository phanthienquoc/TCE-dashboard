export type ContractErrorCode =
  'UNAVAILABLE' | 'UNAUTHORIZED' | 'INVALID_INPUT' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_ERROR';
export type ContractError = {
  code: ContractErrorCode;
  message: string;
  retryable: boolean;
  provider?: string;
  details?: Record<string, unknown>;
};
export type ContractResult<T> = { ok: true; data: T } | { ok: false; error: ContractError };
