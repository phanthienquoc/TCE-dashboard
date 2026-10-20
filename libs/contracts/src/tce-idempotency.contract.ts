import type { TceExecutionResult } from './tce-execution.contract';

/**
 * Durable store port for execution deduplication.
 *
 * Implementations must atomically reserve a scoped key before dispatch and
 * persist terminal/unknown outcomes. A process-local map is only a cache, never
 * the source of truth across restarts or replicas.
 */
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
  /**
   * Must be atomic under concurrent callers. A repeated scoped key with a
   * different fingerprint is always a conflict.
   */
  reserve(
    reservation: TceExecutionIdempotencyReservation
  ): Promise<TceExecutionIdempotencyReserveResult>;

  /** Persist a definitive result or UNKNOWN/reconciliation-required outcome. */
  complete(
    scope: TceExecutionIdempotencyScope,
    fingerprint: string,
    result: TceExecutionResult,
    updatedAt: string
  ): Promise<TceExecutionIdempotencyRecord>;
}
