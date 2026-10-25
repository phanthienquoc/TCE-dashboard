import { describe, expect, it, vi } from 'vitest';
import { SupabaseExecutionIdempotencyAdapter } from './supabase.execution-idempotency.adapter';

const reservation = {
  scope: { accountId: 'account-1', environment: 'PAPER', idempotencyKey: 'idem-1' },
  fingerprint: 'fingerprint-1',
  executionIntentId: 'intent-1',
  correlationId: 'corr-1',
  clientRequestId: 'client-1',
  createdAt: '2026-10-21T12:00:00.000Z',
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    account_id: 'account-1',
    environment: 'PAPER',
    idempotency_key: 'idem-1',
    command_fingerprint: 'fingerprint-1',
    execution_intent_id: 'intent-1',
    correlation_id: 'corr-1',
    client_request_id: 'client-1',
    status: 'PENDING',
    result: null,
    created_at: reservation.createdAt,
    updated_at: reservation.createdAt,
    ...overrides,
  };
}

describe('SupabaseExecutionIdempotencyAdapter', () => {
  it('reserves by a composite scoped key using a single insert', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: row(), error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const insert = vi.fn().mockReturnValue({ select });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as any;

    const store = new SupabaseExecutionIdempotencyAdapter(db);
    const result = await store.reserve(reservation);

    expect(result.kind).toBe('RESERVED');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'account-1',
        environment: 'PAPER',
        idempotency_key: 'idem-1',
        command_fingerprint: 'fingerprint-1',
        status: 'PENDING',
        result: null,
      })
    );
  });

  it('returns the existing record for the same fingerprint', async () => {
    const maybeSingleInsert = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const selectInsert = vi.fn().mockReturnValue({ maybeSingle: maybeSingleInsert });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const completedResult = {
      ok: true,
      operation: 'SUBMIT',
      status: 'SUBMITTED',
      executionIntentId: 'intent-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      clientRequestId: 'client-1',
      providerOrderId: 'provider-order-1',
    };
    const maybeSingleRead = vi.fn().mockResolvedValue({
      data: row({ status: 'COMPLETED', result: completedResult }),
      error: null,
    });
    const eq3 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleRead });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectRead = vi.fn().mockReturnValue({ eq: eq1 });
    const db = {
      from: vi.fn().mockImplementation(() => ({ insert, select: selectRead })),
    } as any;

    const store = new SupabaseExecutionIdempotencyAdapter(db);
    const result = await store.reserve(reservation);
    expect(result.kind).toBe('EXISTING');
    expect(result.record.status).toBe('COMPLETED');
    expect(result.record.result).toEqual(completedResult);
  });

  it('rejects reusing a scoped key for a different fingerprint', async () => {
    const maybeSingleInsert = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const selectInsert = vi.fn().mockReturnValue({ maybeSingle: maybeSingleInsert });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const maybeSingleRead = vi
      .fn()
      .mockResolvedValue({ data: row({ command_fingerprint: 'other' }), error: null });
    const eq3 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleRead });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectRead = vi.fn().mockReturnValue({ eq: eq1 });
    const db = {
      from: vi.fn().mockImplementation(() => ({ insert, select: selectRead })),
    } as any;

    const store = new SupabaseExecutionIdempotencyAdapter(db);
    const result = await store.reserve(reservation);
    expect(result.kind).toBe('FINGERPRINT_CONFLICT');
  });

  it('looks up a duplicate idempotency key within the requested account and environment', async () => {
    const scopedReservation = {
      ...reservation,
      scope: { ...reservation.scope, accountId: 'account-2', environment: 'LIVE' },
    };
    const maybeSingleInsert = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const selectInsert = vi.fn().mockReturnValue({ maybeSingle: maybeSingleInsert });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const maybeSingleRead = vi.fn().mockResolvedValue({
      data: row({ account_id: 'account-2', environment: 'LIVE' }),
      error: null,
    });
    const eq3 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleRead });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectRead = vi.fn().mockReturnValue({ eq: eq1 });
    const db = {
      from: vi.fn().mockImplementation(() => ({ insert, select: selectRead })),
    } as any;

    const result = await new SupabaseExecutionIdempotencyAdapter(db).reserve(scopedReservation);

    expect(result.kind).toBe('EXISTING');
    expect(result.record.reservation.scope).toEqual(scopedReservation.scope);
    expect(eq1).toHaveBeenCalledWith('account_id', 'account-2');
    expect(eq2).toHaveBeenCalledWith('environment', 'LIVE');
    expect(eq3).toHaveBeenCalledWith('idempotency_key', 'idem-1');
  });

  it('returns an existing UNKNOWN reservation without resetting or overwriting it', async () => {
    const unknownResult = {
      ok: false,
      operation: 'SUBMIT',
      status: 'UNKNOWN',
      executionIntentId: 'intent-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      clientRequestId: 'client-1',
      error: {
        code: 'TIMEOUT_UNKNOWN',
        message: 'provider outcome is unknown',
        retryable: false,
        reconciliationRequired: true,
      },
    };
    const unknownRow = row({
      status: 'UNKNOWN',
      result: unknownResult,
      updated_at: '2026-10-21T12:01:00.000Z',
    });
    const maybeSingleInsert = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const selectInsert = vi.fn().mockReturnValue({ maybeSingle: maybeSingleInsert });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const maybeSingleRead = vi.fn().mockResolvedValue({ data: unknownRow, error: null });
    const eq3 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleRead });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectRead = vi.fn().mockReturnValue({ eq: eq1 });
    const db = {
      from: vi.fn().mockImplementation(() => ({ insert, select: selectRead })),
    } as any;

    const store = new SupabaseExecutionIdempotencyAdapter(db);
    const result = await store.reserve(reservation);

    expect(result.kind).toBe('EXISTING');
    expect(result.record.status).toBe('UNKNOWN');
    expect(result.record.result).toEqual(unknownResult);
    expect(result.record.updatedAt).toBe(unknownRow.updated_at);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an UNKNOWN reservation on a later completion attempt', async () => {
    const unknownResult = {
      ok: false,
      operation: 'SUBMIT',
      status: 'UNKNOWN',
      executionIntentId: 'intent-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      clientRequestId: 'client-1',
      error: {
        code: 'TIMEOUT_UNKNOWN',
        message: 'provider outcome is unknown',
        retryable: false,
        reconciliationRequired: true,
      },
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqStatus = vi.fn().mockReturnValue({ select });
    const eqFingerprint = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqIdempotencyKey = vi.fn().mockReturnValue({ eq: eqFingerprint });
    const eqEnvironment = vi.fn().mockReturnValue({ eq: eqIdempotencyKey });
    const eqAccount = vi.fn().mockReturnValue({ eq: eqEnvironment });
    const update = vi.fn().mockReturnValue({ eq: eqAccount });
    const db = { from: vi.fn().mockReturnValue({ update }) } as any;
    const store = new SupabaseExecutionIdempotencyAdapter(db);

    await expect(
      store.complete(
        reservation.scope,
        reservation.fingerprint,
        unknownResult as any,
        '2026-10-21T12:02:00.000Z'
      )
    ).rejects.toThrow('Idempotency completion did not match a pending reservation');

    expect(eqStatus).toHaveBeenCalledWith('status', 'PENDING');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNKNOWN', result: unknownResult })
    );
  });

  it('persists unknown outcomes as reconciliation-required', async () => {
    const result = {
      ok: false,
      operation: 'SUBMIT',
      status: 'UNKNOWN',
      executionIntentId: 'intent-1',
      correlationId: 'corr-1',
      idempotencyKey: 'idem-1',
      clientRequestId: 'client-1',
      error: {
        code: 'TIMEOUT_UNKNOWN',
        message: 'timeout',
        retryable: false,
        reconciliationRequired: true,
      },
    };
    const savedRow = row({
      status: 'UNKNOWN',
      result,
      updated_at: '2026-10-21T12:01:00.000Z',
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: savedRow, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqStatus = vi.fn().mockReturnValue({ select });
    const eqFingerprint = vi.fn().mockReturnValue({ eq: eqStatus });
    const eqIdempotencyKey = vi.fn().mockReturnValue({ eq: eqFingerprint });
    const eqEnvironment = vi.fn().mockReturnValue({ eq: eqIdempotencyKey });
    const eqAccount = vi.fn().mockReturnValue({ eq: eqEnvironment });
    const update = vi.fn().mockReturnValue({ eq: eqAccount });
    const db = { from: vi.fn().mockReturnValue({ update }) } as any;

    const store = new SupabaseExecutionIdempotencyAdapter(db);
    const saved = await store.complete(
      reservation.scope,
      reservation.fingerprint,
      result as any,
      '2026-10-21T12:01:00.000Z'
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'UNKNOWN', result }));
    expect(saved.status).toBe('UNKNOWN');
  });
});
