import { normalizeApiError, type ApiFailure } from './api-errors';

export type SystemUpdatePushFailureLog = Pick<ApiFailure, 'kind' | 'message' | 'retryable'> &
  Partial<Pick<ApiFailure, 'status'>>;

/** Return allow-listed diagnostic metadata; never forward raw browser/Axios errors to logs. */
export function normalizeSystemUpdatePushFailure(error: unknown): SystemUpdatePushFailureLog {
  const failure = normalizeApiError(error, 'Unable to enable system update notifications.');

  return {
    kind: failure.kind,
    message: failure.message,
    retryable: failure.retryable,
    ...(failure.status === undefined ? {} : { status: failure.status }),
  };
}
