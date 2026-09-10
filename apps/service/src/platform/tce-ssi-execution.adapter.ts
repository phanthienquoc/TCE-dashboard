import { Inject, Injectable } from '@nestjs/common';
import type {
  TceExecutionCancelCommand,
  TceExecutionErrorCode,
  TceExecutionPort,
  TceExecutionReplaceCommand,
  TceExecutionResult,
  TceExecutionSubmitCommand,
  TceTradingAuthorizationPort,
} from '@tce/contracts';
import { SsiApplicationService } from './ssi.application.service';
import { SupabaseClientService } from '../db/supabase.client';
import { TceSsiTradingAuthorizationAdapter } from './tce-ssi-trading-authorization.adapter';

type Command = TceExecutionCancelCommand | TceExecutionReplaceCommand | TceExecutionSubmitCommand;

const rejected = (
  command: Command,
  code: TceExecutionErrorCode,
  message: string,
  reconciliationRequired = false,
): TceExecutionResult => ({
  ok: false,
  operation: command.operation,
  status: 'REJECTED',
  executionIntentId: command.operation === 'SUBMIT' ? command.intent.id : command.executionIntentId,
  correlationId: command.authorization.correlationId,
  idempotencyKey: command.authorization.idempotencyKey,
  clientRequestId: command.clientRequestId,
  error: { code, message, retryable: false, reconciliationRequired },
});

@Injectable()
export class TceSsiExecutionAdapter implements TceExecutionPort {
  constructor(
    private readonly ssi: SsiApplicationService,
    private readonly supabase: SupabaseClientService,
    @Inject(TceSsiTradingAuthorizationAdapter)
    private readonly authorization: TceTradingAuthorizationPort,
  ) {}

  async submit(command: TceExecutionSubmitCommand): Promise<TceExecutionResult> {
    if (command.mode !== 'LIVE') {
      return rejected(command, 'UNSUPPORTED_OPERATION', 'SSI live adapter only accepts LIVE execution commands');
    }

    const auth = await this.authorization.ensureAuthorized({
      accountId: command.accountId,
      environment: command.environment,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      mode: command.mode,
    });
    if (!auth.ok) return rejected(command, 'AUTHORIZATION_REQUIRED', auth.error.message);
    if (auth.data.state !== 'READY') {
      const code: TceExecutionErrorCode =
        auth.data.state === 'EXPIRED'
          ? 'AUTHORIZATION_EXPIRED'
          : auth.data.state === 'APPROVAL_REQUIRED'
            ? 'APPROVAL_REQUIRED'
            : 'AUTHORIZATION_REQUIRED';
      return rejected(command, code, `SSI authorization is ${auth.data.state.toLowerCase()}`);
    }

    const account = await this.supabase.db
      .from('tce_accounts')
      .select('id,user_id')
      .eq('id', command.accountId)
      .maybeSingle();
    if (account.error) return rejected(command, 'INVALID_ACCOUNT', 'Unable to resolve TCE account');
    if (!account.data?.user_id) return rejected(command, 'INVALID_ACCOUNT', 'TCE account is not configured');

    const intent = command.intent;
    if (!Number.isInteger(intent.quantity) || intent.quantity <= 0) {
      return rejected(command, 'INVALID_ORDER', 'Execution quantity must be a positive integer');
    }
    const hasLimit = Number.isFinite(intent.limitPrice) && Number(intent.limitPrice) > 0;
    const result = await this.ssi.placeOrder(String(account.data.user_id), command.environment, {
      symbol: intent.symbol,
      side: intent.side,
      quantity: intent.quantity,
      orderType: hasLimit ? 'LO' : 'MTL',
      ...(hasLimit ? { price: Number(intent.limitPrice) } : {}),
      clientRequestId: command.clientRequestId,
    });

    if (!result.ok) {
      const message = result.error.message;
      const lower = message.toLowerCase();
      const code: TceExecutionErrorCode =
        lower.includes('reauth') || lower.includes('approval')
          ? 'APPROVAL_REQUIRED'
          : lower.includes('timeout') || lower.includes('timed out')
            ? 'TIMEOUT_UNKNOWN'
            : 'PROVIDER_REJECTED';
      return rejected(command, code, message, code === 'TIMEOUT_UNKNOWN');
    }

    const providerOrderId = result.data.confirmedOrderId ?? result.data.orderId;
    return {
      ok: true,
      operation: 'SUBMIT',
      status: result.data.confirmed ? 'SUBMITTED' : 'PENDING',
      executionIntentId: intent.id,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      providerOrderId,
      clientRequestId: result.data.clientRequestId ?? command.clientRequestId,
      providerStatus: result.data.providerStatus ?? result.data.status,
    };
  }

  async cancel(command: TceExecutionCancelCommand): Promise<TceExecutionResult> {
    return rejected(command, 'UNSUPPORTED_OPERATION', 'SSI CANCEL adapter semantics are not implemented yet');
  }

  async replace(command: TceExecutionReplaceCommand): Promise<TceExecutionResult> {
    return rejected(command, 'UNSUPPORTED_OPERATION', 'SSI REPLACE adapter semantics are not implemented yet');
  }
}
