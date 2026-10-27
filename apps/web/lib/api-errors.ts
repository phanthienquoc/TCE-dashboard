import axios from 'axios';

export type ApiErrorKind = 'cancelled' | 'timeout' | 'network' | 'http' | 'unknown';

export type ApiFailure = {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  retryable: boolean;
};

/**
 * Axios cancellation is a control-flow outcome, not a user-facing API failure.
 * Treat both AbortSignal cancellations and Axios cancellation errors consistently.
 */
export function isApiRequestCancelled(error: unknown): boolean {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
  );
}

/**
 * Convert transport errors into safe, predictable UI state.
 * Do not surface arbitrary response bodies: they may contain internal details.
 * This helper deliberately does not retry requests; retry policy belongs to the caller.
 */
export function normalizeApiError(
  error: unknown,
  fallbackMessage = 'The request could not be completed.'
): ApiFailure {
  if (isApiRequestCancelled(error)) {
    return {
      kind: 'cancelled',
      message: 'Request cancelled.',
      retryable: false,
    };
  }

  if (!axios.isAxiosError(error)) {
    return {
      kind: 'unknown',
      message: fallbackMessage,
      retryable: false,
    };
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      kind: 'timeout',
      message: 'The request timed out. Please try again.',
      retryable: true,
    };
  }

  if (!error.response) {
    return {
      kind: 'network',
      message: 'Unable to reach the service. Check your connection and try again.',
      retryable: true,
    };
  }

  const status = error.response.status;
  let message = `Request failed (HTTP ${status}).`;

  if (status === 401) {
    message = 'Your session could not be verified. Please sign in again.';
  } else if (status === 403) {
    message = 'You do not have permission to perform this action.';
  } else if (status === 404) {
    message = 'The requested resource was not found.';
  } else if (status === 409) {
    message = 'The request conflicts with the current state. Refresh and try again.';
  } else if (status === 429) {
    message = 'Too many requests. Wait briefly and try again.';
  } else if (status >= 500) {
    message = 'The service is temporarily unavailable. Please try again.';
  }

  return {
    kind: 'http',
    message,
    status,
    retryable: status === 408 || status === 429 || status >= 500,
  };
}


