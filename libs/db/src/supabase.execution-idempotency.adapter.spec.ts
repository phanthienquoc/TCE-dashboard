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
    const maybeSingleRead = vi
      .fn()
      .mockResolvedValue({ data: row({ status: 'COMPLETED' }), error: null });
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
