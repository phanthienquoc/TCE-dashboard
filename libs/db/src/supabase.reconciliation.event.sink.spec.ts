import { SupabaseReconciliationLifecycleSink } from './supabase.reconciliation.event.sink';

describe('SupabaseReconciliationLifecycleSink', () => {
  const event = {
    eventId: 'event-1',
    type: 'RECONCILIATION_TERMINAL' as const,
    runId: 'run-1',
    accountId: 'acct-1',
    environment: 'PAPER',
    correlationId: 'corr-1',
    observedAt: '2026-09-11T04:00:00.000Z',
    disposition: 'TERMINAL' as const,
    localOrderId: 'local-1',
    providerOrderId: 'provider-1',
    providerState: 'FILLED',
    providerStatus: 'FILLED',
    localStatus: 'FILLED',
    localFilledQuantity: 10,
    providerFilledQuantity: 10,
    reason: 'terminal state converged',
  };

  it('reads durable event identity from Supabase', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { event_id: event.eventId }, error: null });
    const db = {
      from: jest
        .fn()
        .mockReturnValue({
          select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle }) }),
        }),
    } as any;
    const sink = new SupabaseReconciliationLifecycleSink(db);
    await expect(sink.has(event.eventId)).resolves.toBe(true);
  });

  it('publishes the full event payload', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const db = { from: jest.fn().mockReturnValue({ insert }) } as any;
    const sink = new SupabaseReconciliationLifecycleSink(db);
    await sink.publish(event);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: event.eventId,
        run_id: event.runId,
        account_id: event.accountId,
        event_type: event.type,
        disposition: event.disposition,
      })
    );
  });

  it('treats the database unique constraint as idempotent', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '23505' } });
    const db = { from: jest.fn().mockReturnValue({ insert }) } as any;
    const sink = new SupabaseReconciliationLifecycleSink(db);
    await expect(sink.publish(event)).resolves.toBeUndefined();
  });

  it('fails closed on missing identity', async () => {
    const sink = new SupabaseReconciliationLifecycleSink({} as any);
    await expect(sink.publish({ ...event, accountId: '' })).rejects.toThrow(
      'runId, accountId and environment are required'
    );
  });
});
