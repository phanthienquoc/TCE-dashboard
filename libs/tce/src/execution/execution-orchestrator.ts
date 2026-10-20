import type {
  TceExecutionCancelCommand,
  TceExecutionCommand,
  TceExecutionIdempotencyRecord,
  TceExecutionIdempotencyScope,
  TceExecutionIdempotencyStore,
  TceExecutionPort,
  TceExecutionReplaceCommand,
  TceExecutionResult,
  TceExecutionSubmitCommand,
} from '@tce/contracts';
import { fingerprintExecutionCommand } from './execution-command-fingerprint.js';

type ExecutionOrchestratorResult = Readonly<{
  ok: boolean;
  result: TceExecutionResult;
}>;

export type TceExecutionOrchestratorOptions = Readonly<{
  idempotencyStore?: TceExecutionIdempotencyStore;
  now?: () => Date;
}>;

const invalidResult = (
  command: TceExecutionCommand,
  code: 'AUTHORIZATION_REQUIRED' | 'INVALID_COMMAND' | 'DUPLICATE_REQUEST',
  message: string
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
  private readonly completed = new Map<
    string,
    { fingerprint: string; result: TceExecutionResult }
  >();

  constructor(
    private readonly port: TceExecutionPort,
    private readonly options: TceExecutionOrchestratorOptions = {}
  ) {}

  async execute(command: TceExecutionCommand): Promise<ExecutionOrchestratorResult> {
    const validation = this.validate(command);
    if (validation) return validation;

    const now = (this.options.now ?? (() => new Date()))().toISOString();
    const scope = this.scope(command);
    const fingerprint = fingerprintExecutionCommand(command);

    if (this.options.idempotencyStore) {
      const reservation = await this.options.idempotencyStore.reserve({
        scope,
        fingerprint,
        executionIntentId:
          command.operation === 'SUBMIT' ? command.intent.id : command.executionIntentId,
        correlationId: command.authorization.correlationId,
        clientRequestId: command.clientRequestId,
        createdAt: now,
      });
      if (reservation.kind === 'FINGERPRINT_CONFLICT') {
        return invalidResult(
          command,
          'DUPLICATE_REQUEST',
          'Idempotency key was already reserved for a different command'
        );
      }
      if (reservation.kind === 'EXISTING') {
        return this.resultForExisting(command, reservation.record);
      }
    } else {
      const localKey = this.scopeKey(scope);
      const existing = this.completed.get(localKey);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return invalidResult(
            command,
            'DUPLICATE_REQUEST',
            'Idempotency key was already used for a different command'
          );
        }
        return { ok: existing.result.ok, result: existing.result };
      }
    }

    let result: TceExecutionResult;
    try {
      result = await this.dispatch(command);
    } catch (error) {
      result = {
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
    }

    if (this.options.idempotencyStore) {
      await this.options.idempotencyStore.complete(scope, fingerprint, result, now);
    } else {
      this.completed.set(this.scopeKey(scope), { fingerprint, result });
    }
    return { ok: result.ok, result };
  }

  private resultForExisting(
    command: TceExecutionCommand,
    record: TceExecutionIdempotencyRecord
  ): ExecutionOrchestratorResult {
    if (record.status === 'COMPLETED' && record.result) {
      return { ok: record.result.ok, result: record.result };
    }
    const unknown = record.status === 'UNKNOWN';
    const status = unknown ? 'UNKNOWN' : 'PENDING';
    const result: TceExecutionResult = record.result ?? {
      ok: false,
      operation: command.operation,
      status,
      executionIntentId:
        command.operation === 'SUBMIT' ? command.intent.id : command.executionIntentId,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      clientRequestId: command.clientRequestId,
      error: {
        code: unknown ? 'TIMEOUT_UNKNOWN' : 'DUPLICATE_REQUEST',
        message: unknown
          ? 'Previous attempt has an unknown outcome; reconciliation is required'
          : 'An execution with this idempotency key is already pending',
        retryable: false,
        reconciliationRequired: unknown,
      },
    };
    return { ok: false, result };
  }

  private scope(command: TceExecutionCommand): TceExecutionIdempotencyScope {
    return {
      accountId: command.accountId,
      environment: command.environment,
      idempotencyKey: command.authorization.idempotencyKey,
    };
  }

  private scopeKey(scope: TceExecutionIdempotencyScope): string {
    return [scope.accountId, scope.environment, scope.idempotencyKey].join('|');
  }

  private validate(command: TceExecutionCommand): ExecutionOrchestratorResult | null {
    const auth = command.authorization;
    if (!auth?.approvalId || !auth.correlationId || !auth.idempotencyKey || !auth.approvedAt) {
      return invalidResult(
        command,
        'AUTHORIZATION_REQUIRED',
        'Execution approval identity is required'
      );
    }
    if (
      !command.accountId?.trim() ||
      !command.environment?.trim() ||
      !command.clientRequestId?.trim()
    ) {
      return invalidResult(
        command,
        'INVALID_COMMAND',
        'Execution account, environment and client request identity are required'
      );
    }
    if (command.operation === 'SUBMIT') {
      if (
        command.intent.correlationId !== auth.correlationId ||
        command.intent.idempotencyKey !== auth.idempotencyKey ||
        command.intent.mode !== command.mode
      ) {
        return invalidResult(
          command,
          'INVALID_COMMAND',
          'Execution authorization does not match intent'
        );
      }
      return null;
    }
    if (!command.executionIntentId) {
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
          invalidResult(command, 'INVALID_COMMAND', 'Unsupported execution operation').result
        );
    }
  }
}
