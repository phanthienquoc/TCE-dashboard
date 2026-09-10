import type {
  TceExecutionCancelCommand,
  TceExecutionCommand,
  TceExecutionPort,
  TceExecutionReplaceCommand,
  TceExecutionResult,
  TceExecutionSubmitCommand,
  TceTradingAuthorizationPort,
} from '@tce/contracts';

type AuthorizedExecutionPortResult = Readonly<{
  port: TceExecutionPort;
  authorization: TceTradingAuthorizationPort;
}>;

const authFailure = (
  command: TceExecutionCommand,
  message: string,
  retryable: boolean,
  code: 'AUTHORIZATION_REQUIRED' | 'AUTHORIZATION_EXPIRED' | 'APPROVAL_REQUIRED' | 'PROVIDER_UNAVAILABLE'
): TceExecutionResult => ({
  ok: false,
  operation: command.operation,
  status: 'REJECTED',
  executionIntentId:
    command.operation === 'SUBMIT' ? command.intent.id : command.executionIntentId,
  correlationId: command.authorization.correlationId,
  idempotencyKey: command.authorization.idempotencyKey,
  clientRequestId: command.clientRequestId,
  error: {
    code,
    message,
    retryable,
    reconciliationRequired: false,
  },
});

/**
 * Guards provider execution with a provider-neutral trading authorization port.
 * PAPER mode deliberately skips provider authentication.
 */
export class TceTradingAuthorizedExecutionPort implements TceExecutionPort {
  constructor(private readonly deps: AuthorizedExecutionPortResult) {}

  submit(command: TceExecutionSubmitCommand) {
    return this.execute(command, () => this.deps.port.submit(command));
  }

  cancel(command: TceExecutionCancelCommand) {
    return this.execute(command, () => this.deps.port.cancel(command));
  }

  replace(command: TceExecutionReplaceCommand) {
    return this.execute(command, () => this.deps.port.replace(command));
  }

  private async execute(
    command: TceExecutionCommand,
    operation: () => Promise<TceExecutionResult>
  ): Promise<TceExecutionResult> {
    if (command.mode === 'PAPER') return operation();

    const result = await this.deps.authorization.ensureAuthorized({
      accountId: command.accountId,
      environment: command.environment,
      mode: command.mode,
    });

    if (!result.ok) {
      const error = result.error;
      const message = error.message || 'Trading authorization is unavailable';
      if (error.code === 'UNAUTHORIZED')
        return authFailure(command, message, true, 'AUTHORIZATION_REQUIRED');
      if (error.code === 'UNAVAILABLE')
        return authFailure(command, message, true, 'PROVIDER_UNAVAILABLE');
      return authFailure(command, message, false, 'AUTHORIZATION_REQUIRED');
    }

    if (result.data.state === 'READY') return operation();
    if (result.data.state === 'EXPIRED')
      return authFailure(command, 'Trading authorization expired', true, 'AUTHORIZATION_EXPIRED');
    if (result.data.state === 'APPROVAL_REQUIRED')
      return authFailure(command, 'Trading approval or OTP is required', true, 'APPROVAL_REQUIRED');
    return authFailure(command, 'Trading authorization is unavailable', true, 'PROVIDER_UNAVAILABLE');
  }
}
