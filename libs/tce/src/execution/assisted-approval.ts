import type {
  ContractResult,
  TceTradingAuthorization,
  TceTradingAuthorizationContext,
  TceTradingAuthorizationPort,
} from '@tce/contracts';

export type TceAssistedApprovalRequest = Readonly<{
  approvalId: string;
  accountId: string;
  environment: string;
  correlationId: string;
  idempotencyKey: string;
  transactionId?: string;
  action?: TceTradingAuthorization['approvalAction'];
  message?: string;
}>;

export type TceAssistedApprovalCompletion = Readonly<{
  approvalId: string;
  approved: boolean;
}>;

type PendingApproval = Readonly<{
  approvalId: string;
  context: TceTradingAuthorizationContext;
}>;

const invalid = <T>(message: string): ContractResult<T> => ({
  ok: false,
  error: { code: 'INVALID_INPUT', message, retryable: false },
});

const approvalRequest = (
  approvalId: string,
  context: TceTradingAuthorizationContext,
  authorization: TceTradingAuthorization
): TceAssistedApprovalRequest => ({
  approvalId,
  accountId: context.accountId,
  environment: context.environment,
  correlationId: context.correlationId,
  idempotencyKey: context.idempotencyKey,
  transactionId: authorization.transactionId,
  action: authorization.approvalAction,
  message: authorization.approvalMessage,
});

/**
 * Provider-neutral ASSISTED approval handoff. User approval is explicit and
 * credentials/OTP values are intentionally not part of the handoff contract.
 */
export class TceAssistedApprovalHandoff {
  private readonly pending = new Map<string, PendingApproval>();

  constructor(private readonly authorization: TceTradingAuthorizationPort) {}

  async request(
    context: TceTradingAuthorizationContext
  ): Promise<ContractResult<TceAssistedApprovalRequest>> {
    if (context.mode !== 'ASSISTED') {
      return invalid('ASSISTED approval handoff requires ASSISTED execution mode');
    }

    const result = await this.authorization.requestApproval(context);
    if (!result.ok) return result;
    if (result.data.state !== 'APPROVAL_REQUIRED') {
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Trading authorization did not produce an approval challenge',
          retryable: true,
          provider: result.data.provider,
        },
      };
    }

    const approvalId = result.data.transactionId ?? context.idempotencyKey;
    this.pending.set(approvalId, { approvalId, context });
    return { ok: true, data: approvalRequest(approvalId, context, result.data) };
  }

  async complete(
    completion: TceAssistedApprovalCompletion
  ): Promise<ContractResult<TceTradingAuthorization>> {
    const pending = this.pending.get(completion.approvalId);
    if (!pending) return invalid('Unknown or expired ASSISTED approval request');

    if (!completion.approved) {
      this.pending.delete(completion.approvalId);
      return {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Trading approval was declined',
          retryable: false,
        },
      };
    }

    const result = await this.authorization.ensureAuthorized(pending.context);
    if (!result.ok) return result;
    if (result.data.state !== 'READY') {
      return {
        ok: false,
        error: {
          code: result.data.state === 'EXPIRED' ? 'UNAUTHORIZED' : 'PROVIDER_ERROR',
          message: `Trading authorization is ${result.data.state.toLowerCase()} after approval`,
          retryable: true,
          provider: result.data.provider,
        },
      };
    }

    this.pending.delete(completion.approvalId);
    return result;
  }
}
