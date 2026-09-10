import { describe, expect, it, vi } from 'vitest';
import { TceAssistedApprovalHandoff } from './assisted-approval';
import type { TceTradingAuthorizationPort } from '@tce/contracts';

const context = {
  accountId: 'tce-1',
  environment: 'paper',
  mode: 'ASSISTED' as const,
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
};

const ready = {
  state: 'READY' as const,
  provider: 'ssi',
  accountId: 'tce-1',
  environment: 'paper',
  checkedAt: '2026-09-10T00:00:00.000Z',
};

const challenge = {
  state: 'APPROVAL_REQUIRED' as const,
  provider: 'ssi',
  accountId: 'tce-1',
  environment: 'paper',
  checkedAt: '2026-09-10T00:00:00.000Z',
  transactionId: 'tx-1',
  approvalAction: 'APPROVE_OR_ENTER_OTP' as const,
  approvalMessage: 'Approve the SSI request',
};

describe('TceAssistedApprovalHandoff', () => {
  it('creates a safe approval request without OTP or credentials', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: vi.fn().mockResolvedValue({ ok: true, data: ready }),
      requestApproval: vi.fn().mockResolvedValue({ ok: true, data: challenge }),
    };
    const handoff = new TceAssistedApprovalHandoff(authorization);

    const result = await handoff.request(context);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.approvalId).toBe('tx-1');
      expect(result.data.transactionId).toBe('tx-1');
      expect(result.data.correlationId).toBe('corr-1');
      expect(JSON.stringify(result.data)).not.toMatch(/otp|token|secret|credential/i);
    }
  });

  it('requires explicit approval completion before returning READY authorization', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: vi.fn().mockResolvedValue({ ok: true, data: ready }),
      requestApproval: vi.fn().mockResolvedValue({ ok: true, data: challenge }),
    };
    const handoff = new TceAssistedApprovalHandoff(authorization);

    await handoff.request(context);
    const result = await handoff.complete({ approvalId: 'tx-1', approved: true });

    expect(result.ok).toBe(true);
    expect(authorization.ensureAuthorized).toHaveBeenCalledWith(context);
  });

  it('fails closed when the user declines approval', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: vi.fn(),
      requestApproval: vi.fn().mockResolvedValue({ ok: true, data: challenge }),
    };
    const handoff = new TceAssistedApprovalHandoff(authorization);

    await handoff.request(context);
    const result = await handoff.complete({ approvalId: 'tx-1', approved: false });

    expect(result.ok).toBe(false);
    expect(authorization.ensureAuthorized).not.toHaveBeenCalled();
  });

  it('rejects completion for an unknown approval id', async () => {
    const authorization: TceTradingAuthorizationPort = {
      ensureAuthorized: vi.fn(),
      requestApproval: vi.fn(),
    };
    const handoff = new TceAssistedApprovalHandoff(authorization);

    const result = await handoff.complete({ approvalId: 'missing', approved: true });
    expect(result.ok).toBe(false);
  });
});
