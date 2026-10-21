import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafeOrderExecutionService } from './safe-order-execution.service';

const action = {
  idempotencyKey: 'DPM-campaign-1-1-BUY',
  campaignId: 'campaign-1',
  positionId: 'position-1',
  type: 'BUY' as const,
  quantity: 100,
  reason: 'test action',
};

function makeService() {
  const repository = {
    ensureIndexes: vi.fn().mockResolvedValue(undefined),
    getAction: vi.fn().mockResolvedValue(null),
    saveAction: vi.fn().mockResolvedValue(undefined),
    listPending: vi.fn().mockResolvedValue([]),
  };
  return {
    service: new SafeOrderExecutionService(repository as any),
    repository,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SafeOrderExecutionService production safety', () => {
  it('blocks LIVE dispatch before database or provider work unless explicitly enabled', async () => {
    vi.stubEnv('DRE_ENABLED', 'true');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'false');
    const { service, repository } = makeService();
    const executor = { execute: vi.fn().mockResolvedValue({ accepted: true }) };

    await expect(service.submit(action, 'run-1', 'LIVE', executor)).rejects.toThrow(
      'DRE live execution is disabled by configuration'
    );
    expect(repository.ensureIndexes).not.toHaveBeenCalled();
    expect(repository.saveAction).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('blocks all DRE execution when DRE is disabled', async () => {
    vi.stubEnv('DRE_ENABLED', 'false');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'true');
    const { service, repository } = makeService();
    const executor = { execute: vi.fn().mockResolvedValue({ accepted: true }) };

    await expect(service.submit(action, 'run-1', 'DRY_RUN', executor)).rejects.toThrow(
      'DRE is disabled by configuration'
    );
    expect(repository.ensureIndexes).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('does not redispatch an existing UNKNOWN action even when LIVE is enabled', async () => {
    vi.stubEnv('DRE_ENABLED', 'true');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'true');
    const { service, repository } = makeService();
    repository.getAction.mockResolvedValue({
      ...action,
      runId: 'run-previous',
      status: 'UNKNOWN',
      externalId: 'ssi-uncertain',
      error: 'provider timeout',
    });
    const executor = {
      execute: vi.fn().mockResolvedValue({ accepted: true, externalId: 'ssi-new' }),
    };

    await expect(service.submit(action, 'run-retry', 'LIVE', executor)).resolves.toEqual({
      status: 'UNKNOWN',
      externalId: 'ssi-uncertain',
    });
    expect(repository.getAction).toHaveBeenCalledWith(action.idempotencyKey);
    expect(repository.saveAction).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('requires an explicit LIVE executor before persisting a new action', async () => {
    vi.stubEnv('DRE_ENABLED', 'true');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'true');
    const { service, repository } = makeService();

    await expect(service.submit(action, 'run-1', 'LIVE')).rejects.toThrow(
      'Live execution adapter is required explicitly'
    );
    expect(repository.ensureIndexes).toHaveBeenCalledTimes(1);
    expect(repository.getAction).toHaveBeenCalledWith(action.idempotencyKey);
    expect(repository.saveAction).not.toHaveBeenCalled();
  });

  it('does not redispatch an existing PARTIAL action', async () => {
    vi.stubEnv('DRE_ENABLED', 'true');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'true');
    const { service, repository } = makeService();
    repository.getAction.mockResolvedValue({
      ...action,
      runId: 'run-previous',
      status: 'PARTIAL',
      externalId: 'ssi-partial',
      filledQuantity: 40,
    });
    const executor = {
      execute: vi.fn().mockResolvedValue({ accepted: true, externalId: 'ssi-new' }),
    };

    await expect(service.submit(action, 'run-retry', 'LIVE', executor)).resolves.toEqual({
      status: 'PARTIAL',
      externalId: 'ssi-partial',
    });
    expect(repository.getAction).toHaveBeenCalledWith(action.idempotencyKey);
    expect(repository.saveAction).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('keeps DRY_RUN available when DRE is enabled and live execution remains disabled', async () => {
    vi.stubEnv('DRE_ENABLED', 'true');
    vi.stubEnv('DRE_LIVE_EXECUTION', 'false');
    const { service, repository } = makeService();

    await expect(service.submit(action, 'run-1', 'DRY_RUN')).resolves.toEqual({
      status: 'PENDING',
    });
    expect(repository.saveAction).toHaveBeenCalledWith({
      ...action,
      runId: 'run-1',
      status: 'PENDING',
    });
  });
});
