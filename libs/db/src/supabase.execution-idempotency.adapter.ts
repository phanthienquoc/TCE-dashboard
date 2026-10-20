import type {
  TceExecutionIdempotencyRecord,
  TceExecutionIdempotencyReservation,
  TceExecutionIdempotencyReserveResult,
  TceExecutionIdempotencyScope,
  TceExecutionIdempotencyStore,
  TceExecutionResult,
} from '@tce/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

type IdempotencyRow = {
  account_id: string;
  environment: string;
  idempotency_key: string;
  command_fingerprint: string;
  execution_intent_id: string;
  correlation_id: string;
  client_request_id: string;
  status: 'PENDING' | 'COMPLETED' | 'UNKNOWN';
  result: TceExecutionResult | null;
  created_at: string;
  updated_at: string;
};

export class SupabaseExecutionIdempotencyAdapter implements TceExecutionIdempotencyStore {
  constructor(private readonly db: SupabaseClient) {}

  async reserve(
    reservation: TceExecutionIdempotencyReservation
  ): Promise<TceExecutionIdempotencyReserveResult> {
    validateReservation(reservation);
    const { scope } = reservation;
    const row: IdempotencyRow = {
      account_id: scope.accountId,
      environment: scope.environment,
      idempotency_key: scope.idempotencyKey,
      command_fingerprint: reservation.fingerprint,
      execution_intent_id: reservation.executionIntentId,
      correlation_id: reservation.correlationId,
      client_request_id: reservation.clientRequestId,
      status: 'PENDING',
      result: null,
      created_at: reservation.createdAt,
      updated_at: reservation.createdAt,
    };

    // The composite primary key makes the insert the atomic reservation point
    // across workers/replicas. A uniqueness error means another row won.
    const inserted = await this.db
      .from('tce_execution_idempotency')
      .insert(row)
      .select('*')
      .maybeSingle();
    if (!inserted.error) {
      if (!inserted.data) throw new Error('Idempotency reservation returned no row');
      return { kind: 'RESERVED', record: fromRow(inserted.data as IdempotencyRow) };
    }
    if (!isUniqueViolation(inserted.error)) throw inserted.error;

    const existing = await this.find(scope);
    if (!existing) throw new Error('Idempotency key conflicted but no record was found');
    return {
      kind:
        existing.reservation.fingerprint === reservation.fingerprint
          ? 'EXISTING'
          : 'FINGERPRINT_CONFLICT',
      record: existing,
    };
  }

  async complete(
    scope: TceExecutionIdempotencyScope,
    fingerprint: string,
    result: TceExecutionResult,
    updatedAt: string
  ): Promise<TceExecutionIdempotencyRecord> {
    validateScope(scope);
    if (!fingerprint.trim()) throw new Error('fingerprint is required');
    if (result.idempotencyKey !== scope.idempotencyKey) {
      throw new Error('execution result idempotency key does not match scope');
    }
    const status =
      result.status === 'UNKNOWN' || result.error?.reconciliationRequired ? 'UNKNOWN' : 'COMPLETED';
    const { data, error } = await this.db
      .from('tce_execution_idempotency')
      .update({ status, result, updated_at: updatedAt })
      .eq('account_id', scope.accountId)
      .eq('environment', scope.environment)
      .eq('idempotency_key', scope.idempotencyKey)
      .eq('command_fingerprint', fingerprint)
      .eq('status', 'PENDING')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Idempotency completion did not match a pending reservation');
    return fromRow(data as IdempotencyRow);
  }

  private async find(
    scope: TceExecutionIdempotencyScope
  ): Promise<TceExecutionIdempotencyRecord | null> {
    const { data, error } = await this.db
      .from('tce_execution_idempotency')
      .select('*')
      .eq('account_id', scope.accountId)
      .eq('environment', scope.environment)
      .eq('idempotency_key', scope.idempotencyKey)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as IdempotencyRow) : null;
  }
}

function fromRow(row: IdempotencyRow): TceExecutionIdempotencyRecord {
  const reservation: TceExecutionIdempotencyReservation = {
    scope: {
      accountId: row.account_id,
      environment: row.environment,
      idempotencyKey: row.idempotency_key,
    },
    fingerprint: row.command_fingerprint,
    executionIntentId: row.execution_intent_id,
    correlationId: row.correlation_id,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
  };
  return {
    reservation,
    status: row.status,
    result: row.result ?? undefined,
    updatedAt: row.updated_at,
  };
}

function validateReservation(reservation: TceExecutionIdempotencyReservation): void {
  validateScope(reservation.scope);
  if (!reservation.fingerprint.trim()) throw new Error('fingerprint is required');
  if (!reservation.executionIntentId.trim()) throw new Error('executionIntentId is required');
  if (!reservation.correlationId.trim()) throw new Error('correlationId is required');
  if (!reservation.clientRequestId.trim()) throw new Error('clientRequestId is required');
  if (!Number.isFinite(Date.parse(reservation.createdAt))) {
    throw new Error('createdAt must be a valid timestamp');
  }
}

function validateScope(scope: TceExecutionIdempotencyScope): void {
  if (!scope.accountId.trim()) throw new Error('accountId is required');
  if (!scope.environment.trim()) throw new Error('environment is required');
  if (!scope.idempotencyKey.trim()) throw new Error('idempotencyKey is required');
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === '23505';
}
