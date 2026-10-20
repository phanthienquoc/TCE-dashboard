import { describe, expect, it, vi } from 'vitest';
import { ProfitExitExecutionService } from './profit-exit-execution.service';

const order = {
  id: 'order-1',
  account_id: 'account-1',
  symbol: 'DPM',
  side: 'SELL',
  price: 31_000,
  quantity: 100,
  status: 'READY',
  note: 'TCE_AUTO_SELL:TP',
};

function makeSupabase() {
  const query: Record<string, any> = {};
  for (const method of ['select', 'eq', 'like', 'order', 'update']) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: [order], error: null }).then(resolve);
  return { db: { from: vi.fn(() => query) }, query };
}

const executionResult = (
  overrides: Record<string, unknown> = {}
) => ({
  ok: false,
  result: {
    ok: false,
    operation: 'SUBMIT',
    status: 'REJECTED',
    executionIntentId: 'execution-intent:auto-sell:order-1',
    correlationId: 'tce-auto-sell:order-1',
    idempotencyKey: 'tce-auto-sell:order-1',
    clientRequestId: 'TCE-AUTO-SELL-order-1',
    error: {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Durable idempotency store unavailable',
      retryable: true,
      reconciliationRequired: false,
    },
    ...overrides,
  },
});

describe('ProfitExitExecutionService durable idempotency handling', () => {
  it('leaves a READY order retryable when reservation fails before dispatch', async () => {
    const { db, query } = makeSupabase();
    const execution = { execute: vi.fn().mockResolvedValue(executionResult()) };
    const service = new ProfitExitExecutionService(db as any, execution as any);

    const result = await service.executeReady('account-1');

    expect(execution.execute).toHaveBeenCalledTimes(1);
    expect(query.update).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      expect.objectContaining({ orderId: 'order-1', status: 'RETRYABLE' }),
    ]);
  });

  it('marks the order UNKNOWN when the outcome requires reconciliation', async () => {
    const { db, query } = makeSupabase();
    const execution = {
      execute: vi.fn().mockResolvedValue(
        executionResult({
          status: 'UNKNOWN',
          error: {
            code: 'UNKNOWN',
            message: 'Outcome could not be persisted',
            retryable: false,
            reconciliationRequired: true,
          },
        })
      ),
    };
    const service = new ProfitExitExecutionService(db as any, execution as any);

    const result = await service.executeReady('account-1');

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNKNOWN' })
    );
    expect(result.results).toEqual([
      expect.objectContaining({ orderId: 'order-1', status: 'UNKNOWN' }),
    ]);
  });

  it('marks thrown orchestrator failures UNKNOWN rather than rejected', async () => {
    const { db, query } = makeSupabase();
    const execution = { execute: vi.fn().mockRejectedValue(new Error('unexpected failure')) };
    const service = new ProfitExitExecutionService(db as any, execution as any);

    const result = await service.executeReady('account-1');

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'UNKNOWN' })
    );
    expect(result.results).toEqual([
      expect.objectContaining({ orderId: 'order-1', status: 'UNKNOWN' }),
    ]);
  });
});
