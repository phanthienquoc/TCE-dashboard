import type {
  TceExecutionSubmitCommand,
  TceExecutionPort,
  TceExecutionResult,
  TceTradingAuthorizationPort,
} from '@tce/contracts';
import { TceTradingAuthorizedExecutionPort } from './trading-authorization.js';

const command = (mode: 'PAPER' | 'ASSISTED' | 'LIVE'): TceExecutionSubmitCommand => ({
  operation: 'SUBMIT',
  accountId: 'account-1',
  environment: 'production',
  mode,
  authorization: {
    approvalId: 'approval-1',
    approvedAt: '2026-09-10T07:00:00.000Z',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
  },
  intent: {
    id: 'intent-1',
    orderPlanId: 'plan-1',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    mode,
    symbol: 'DPM',
    side: 'BUY',
    quantity: 100,
    limitPrice: 30000,
    lifecycleState: 'READY',
    createdAt: '2026-09-10T07:00:00.000Z',
  },
  clientRequestId: 'client-1',
});

const success: TceExecutionResult = {
  ok: true,
  operation: 'SUBMIT',
  status: 'SUBMITTED',
  executionIntentId: 'intent-1',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  clientRequestId: 'client-1',
  providerOrderId: 'provider-1',
};

describe('TceTradingAuthorizedExecutionPort', () => {
  it('skips provider authorization in PAPER mode', async () => {
    let authorizationCalls = 0;
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: async () => {
        authorizationCalls += 1;
        return { ok: true, data: {} as never };
      },
    };
    const port: TceExecutionPort = {
      submit: async () => success,
      cancel: async () => success,
      replace: async () => success,
    };

    const result = await new TceTradingAuthorizedExecutionPort({ port, authorization }).submit(
      command('PAPER')
    );

    expect(result).toEqual(success);
    expect(authorizationCalls).toBe(0);
  });

  it('blocks LIVE execution when approval/OTP is required', async () => {
    let submitted = 0;
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: async () => ({
        ok: true,
        data: {
          state: 'APPROVAL_REQUIRED',
          provider: 'ssi',
          accountId: 'account-1',
          environment: 'production',
          checkedAt: '2026-09-10T07:00:00.000Z',
          transactionId: 'tx-1',
        },
      }),
    };
    const port: TceExecutionPort = {
      submit: async () => {
        submitted += 1;
        return success;
      },
      cancel: async () => success,
      replace: async () => success,
    };

    const result = await new TceTradingAuthorizedExecutionPort({ port, authorization }).submit(
      command('LIVE')
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('APPROVAL_REQUIRED');
    expect(submitted).toBe(0);
  });

  it('blocks expired ASSISTED authorization', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: async () => ({
        ok: true,
        data: {
          state: 'EXPIRED',
          provider: 'ssi',
          accountId: 'account-1',
          environment: 'production',
          checkedAt: '2026-09-10T07:00:00.000Z',
        },
      }),
    };
    const port: TceExecutionPort = {
      submit: async () => success,
      cancel: async () => success,
      replace: async () => success,
    };

    const result = await new TceTradingAuthorizedExecutionPort({ port, authorization }).submit(
      command('ASSISTED')
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('AUTHORIZATION_EXPIRED');
    expect(result.error?.retryable).toBe(true);
  });

  it('allows LIVE execution only after a ready authorization', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: async context => ({
        ok: true,
        data: {
          state: 'READY',
          provider: 'ssi',
          accountId: context.accountId,
          environment: context.environment,
          checkedAt: '2026-09-10T07:00:00.000Z',
          expiresAt: '2026-09-10T08:00:00.000Z',
        },
      }),
    };
    const port: TceExecutionPort = {
      submit: async () => success,
      cancel: async () => success,
      replace: async () => success,
    };

    await expect(
      new TceTradingAuthorizedExecutionPort({ port, authorization }).submit(command('LIVE'))
    ).resolves.toEqual(success);
  });
});
