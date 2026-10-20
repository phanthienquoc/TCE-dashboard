export type TceApiSuccess<TData, TMeta = undefined> = Readonly<{
  ok: true;
  data: TData;
  meta?: TMeta;
}>;

export type TceApiError = Readonly<{
  ok: false;
  error: Readonly<{
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  }>;
  requestId?: string;
}>;

/** Control frames are transport metadata, not persisted domain events. */
export type TceTransportControlMessage = Readonly<{
  type: 'transport.error';
  error: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
  }>;
}>;

export function isTceApiError(value: unknown): value is TceApiError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.ok !== false || !candidate.error || typeof candidate.error !== 'object') {
    return false;
  }
  const error = candidate.error as Record<string, unknown>;
  return (
    typeof error.code === 'string' &&
    error.code.length > 0 &&
    typeof error.message === 'string' &&
    error.message.length > 0
  );
}
