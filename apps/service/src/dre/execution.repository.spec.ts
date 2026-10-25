import { describe, expect, it, vi } from 'vitest';
import { DreExecutionRepository } from './execution.repository';

describe('DreExecutionRepository reconciliation sweep', () => {
  it('includes pending, unknown, and partial actions in provider-truth reconciliation', async () => {
    const records = [
      { idempotencyKey: 'pending', status: 'PENDING' },
      { idempotencyKey: 'unknown', status: 'UNKNOWN' },
      { idempotencyKey: 'partial', status: 'PARTIAL' },
    ];
    const toArray = vi.fn().mockResolvedValue(records);
    const sort = vi.fn().mockReturnValue({ toArray });
    const find = vi.fn().mockReturnValue({ sort });
    const collection = vi.fn().mockReturnValue({ find });
    const db = { collection };
    const mongo = { getDb: vi.fn().mockResolvedValue(db) };
    const repository = new DreExecutionRepository(mongo as any);

    await expect(repository.listPending()).resolves.toEqual(records);

    expect(collection).toHaveBeenCalledWith('dre_rolling_actions');
    expect(find).toHaveBeenCalledWith({
      status: { $in: ['PENDING', 'UNKNOWN', 'PARTIAL'] },
    });
    expect(sort).toHaveBeenCalledWith({ submittedAt: 1 });
    expect(toArray).toHaveBeenCalledTimes(1);
  });
});
