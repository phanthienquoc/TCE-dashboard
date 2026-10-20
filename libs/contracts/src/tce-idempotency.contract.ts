import type { TceExecutionResult } from './tce-execution.contract';

export type TceExecutionIdempotencyScope = Readonly<{
  accountId: string;
  environment: string;
  idempotencyKey: string;
}>;

export type TceExecutionIdempotencyReservation = Readonly<{
  scope: TceExecutionIdempotencyScope;
  fingerprint: string;
  executionIntentId: string;
  correlationId: string;
  clientRequestId: string;
  createdAt: string;
}>;

export type TceExecutionIdempotencyRecord = Readonly<{
  reservation: TceExecutionIdempotencyReservation;
  status: 'PENDING' | 'COMPLETED' | 'UNKNOWN';
  result?: TceExecutionResult;
  updatedAt: string;
}>;

export type TceExecutionIdempotencyReserveResult =
  | Readonly<{ kind: 'RESERVED'; record: TceExecutionIdempotencyRecord }>
  | Readonly<{ kind: 'EXISTING'; record: TceExecutionIdempotencyRecord }>
  | Readonly<{ kind: 'FINGERPRINT_CONFLICT'; record: TceExecutionIdempotencyRecord }>;

export interface TceExecutionIdempotencyStore {
  /** Must atomically reserve a key and reject conflicting fingerprints. */
  reserve(
    reservation: TceExecutionIdempotencyReservation
  ): Promise<TceExecutionIdempotencyReserveResult>;

  /** Persist the outcome. Unknown outcomes must never be blindly replayed. */
  complete(
    scope: TceExecutionIdempotencyScope,
    fingerprint: string,
    result: TceExecutionResult,
    updatedAt: string
  ): Promise<TceExecutionIdempotencyRecord>;
}
