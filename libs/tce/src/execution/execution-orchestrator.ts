import type {
  TceExecutionCancelCommand,
  TceExecutionCommand,
  TceExecutionPort,
  TceExecutionReplaceCommand,
  TceExecutionResult,
  TceExecutionSubmitCommand,
} from '@tce/contracts';

type ExecutionOrchestratorResult = Readonly<{
  ok: boolean;
  result: TceExecutionResult;
}>;

const invalidResult = (
  command: TceExecutionCommand,
  code: 'AUTHORIZATION_REQUIRED' | 'INVALID_COMMAND',
  message: string,
): ExecutionOrchestratorResult => ({
  ok: false,
  result: {
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
      retryable: false,
      reconciliationRequired: false,
    },
  },
});

export class TceExecutionOrchestrator {
  private readonly completed = new Map<string, TceExecutionResult>();

  constructor(private readonly port: TceExecutionPort) {}

  async execute(command: TceExecutionCommand): Promise<ExecutionOrchestratorResult> {
    const validation = this.validate(command);
    if (validation) return validation;

    const key = command.authorization.idempotencyKey;
    const existing = this.completed.get(key);
    if (existing) return { ok: existing.ok, result: existing };

    try {
      const result = await this.dispatch(command);
      this.completed.set(key, result);
      return { ok: result.ok, result };
    } catch (error) {
      const result: TceExecutionResult = {
        ok: false,
        operation: command.operation,
        status: 'UNKNOWN',
        executionIntentId:
          command.operation === 'SUBMIT' ? command.intent.id : command.executionIntentId,
        correlationId: command.authorization.correlationId,
        idempotencyKey: command.authorization.idempotencyKey,
        clientRequestId: command.clientRequestId,
        error: {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Execution adapter failed',
          retryable: false,
          reconciliationRequired: true,
        },
      };
      this.completed.set(key, result);
      return { ok: false, result };
    }
  }

  private validate(command: TceExecutionCommand): ExecutionOrchestratorResult | null {
    const auth = command.authorization;
    if (!auth?.approvalId || !auth.correlationId || !auth.idempotencyKey || !auth.approvedAt) {
      return invalidResult(command, 'AUTHORIZATION_REQUIRED', 'Execution approval identity is required');
    }

    if (command.operation === 'SUBMIT') {
      if (
        command.intent.correlationId !== auth.correlationId ||
        command.intent.idempotencyKey !== auth.idempotencyKey ||
        command.intent.mode !== command.mode
      ) {
        return invalidResult(command, 'INVALID_COMMAND', 'Execution authorization does not match intent');
      }
      return null;
    }

    if (!command.executionIntentId || !command.clientRequestId || !command.accountId || !command.environment) {
      return invalidResult(command, 'INVALID_COMMAND', 'Execution command identity is incomplete');
    }

    if (command.operation === 'REPLACE' && !command.providerOrderId) {
      return invalidResult(command, 'INVALID_COMMAND', 'REPLACE requires providerOrderId');
    }

    return null;
  }

  private dispatch(command: TceExecutionCommand): Promise<TceExecutionResult> {
    switch (command.operation) {
      case 'SUBMIT':
        return this.port.submit(command as TceExecutionSubmitCommand);
      case 'CANCEL':
        return this.port.cancel(command as TceExecutionCancelCommand);
      case 'REPLACE':
        return this.port.replace(command as TceExecutionReplaceCommand);
      default:
        return Promise.resolve(
          invalidResult(command, 'INVALID_COMMAND', 'Unsupported execution operation').result,
        );
    }
  }
}
