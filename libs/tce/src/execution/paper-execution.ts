import { createHash } from 'node:crypto';
import type {
  TceExecutionCancelCommand,
  TceExecutionPort,
  TceExecutionReplaceCommand,
  TceExecutionResult,
  TceExecutionSubmitCommand,
} from '@tce/contracts';

type PaperOrder = {
  executionIntentId: string;
  clientRequestId: string;
  symbol: string;
  side: TceExecutionSubmitCommand['intent']['side'];
  quantity: number;
  limitPrice: number;
  filledQuantity: number;
  status: 'SUBMITTED' | 'CANCELLED' | 'REPLACED';
};

const syntheticOrderId = (command: TceExecutionSubmitCommand) =>
  `paper-${createHash('sha256')
    .update(`${command.accountId}:${command.environment}:${command.authorization.idempotencyKey}`)
    .digest('hex')
    .slice(0, 16)}`;

const invalid = (
  command: TceExecutionCancelCommand | TceExecutionReplaceCommand,
  message: string
): TceExecutionResult => ({
  ok: false,
  operation: command.operation,
  status: 'REJECTED',
  executionIntentId: command.executionIntentId,
  correlationId: command.authorization.correlationId,
  idempotencyKey: command.authorization.idempotencyKey,
  clientRequestId: command.clientRequestId,
  error: {
    code: 'INVALID_ORDER',
    message,
    retryable: false,
    reconciliationRequired: false,
  },
});

/**
 * Deterministic in-memory execution port for PAPER mode.
 * It never calls a provider and models submission as accepted with zero fill.
 */
export class TcePaperExecutionPort implements TceExecutionPort {
  private readonly orders = new Map<string, PaperOrder>();
  private readonly requests = new Map<string, TceExecutionResult>();

  async submit(command: TceExecutionSubmitCommand): Promise<TceExecutionResult> {
    if (command.mode !== 'PAPER') {
      return {
        ok: false,
        operation: 'SUBMIT',
        status: 'REJECTED',
        executionIntentId: command.intent.id,
        correlationId: command.authorization.correlationId,
        idempotencyKey: command.authorization.idempotencyKey,
        clientRequestId: command.clientRequestId,
        error: {
          code: 'INVALID_COMMAND',
          message: 'PAPER execution port only accepts PAPER mode',
          retryable: false,
          reconciliationRequired: false,
        },
      };
    }

    const existing = this.requests.get(command.authorization.idempotencyKey);
    if (existing) return existing;

    const quantity = command.intent.quantity;
    const limitPrice = command.intent.limitPrice;
    if (
      !command.intent.symbol.trim() ||
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      typeof limitPrice !== 'number' ||
      !Number.isFinite(limitPrice) ||
      limitPrice <= 0
    ) {
      const result: TceExecutionResult = {
        ok: false,
        operation: 'SUBMIT',
        status: 'REJECTED',
        executionIntentId: command.intent.id,
        correlationId: command.authorization.correlationId,
        idempotencyKey: command.authorization.idempotencyKey,
        clientRequestId: command.clientRequestId,
        error: {
          code: 'INVALID_ORDER',
          message: 'PAPER order requires a valid symbol, quantity and limit price',
          retryable: false,
          reconciliationRequired: false,
        },
      };
      this.requests.set(command.authorization.idempotencyKey, result);
      return result;
    }

    const providerOrderId = syntheticOrderId(command);
    const order: PaperOrder = {
      executionIntentId: command.intent.id,
      clientRequestId: command.clientRequestId,
      symbol: command.intent.symbol.toUpperCase(),
      side: command.intent.side,
      quantity,
      limitPrice,
      filledQuantity: 0,
      status: 'SUBMITTED',
    };
    this.orders.set(providerOrderId, order);

    const result: TceExecutionResult = {
      ok: true,
      operation: 'SUBMIT',
      status: 'SUBMITTED',
      executionIntentId: command.intent.id,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      providerOrderId,
      clientRequestId: command.clientRequestId,
      filledQuantity: 0,
      providerStatus: 'PAPER_ACCEPTED',
    };
    this.requests.set(command.authorization.idempotencyKey, result);
    return result;
  }

  async cancel(command: TceExecutionCancelCommand): Promise<TceExecutionResult> {
    if (command.mode !== 'PAPER')
      return invalid(command, 'PAPER execution port only accepts PAPER mode');
    const existing = command.providerOrderId ? this.orders.get(command.providerOrderId) : undefined;
    if (!existing || existing.executionIntentId !== command.executionIntentId)
      return invalid(command, 'PAPER order reference does not match an existing execution intent');
    if (existing.status === 'CANCELLED') {
      return {
        ok: true,
        operation: 'CANCEL',
        status: 'CANCELLED',
        executionIntentId: command.executionIntentId,
        correlationId: command.authorization.correlationId,
        idempotencyKey: command.authorization.idempotencyKey,
        providerOrderId: command.providerOrderId,
        clientRequestId: command.clientRequestId,
        filledQuantity: existing.filledQuantity,
        providerStatus: 'PAPER_CANCELLED',
      };
    }
    existing.status = 'CANCELLED';
    return {
      ok: true,
      operation: 'CANCEL',
      status: 'CANCELLED',
      executionIntentId: command.executionIntentId,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      providerOrderId: command.providerOrderId,
      clientRequestId: command.clientRequestId,
      filledQuantity: existing.filledQuantity,
      providerStatus: 'PAPER_CANCELLED',
    };
  }

  async replace(command: TceExecutionReplaceCommand): Promise<TceExecutionResult> {
    if (command.mode !== 'PAPER')
      return invalid(command, 'PAPER execution port only accepts PAPER mode');
    const existing = this.orders.get(command.providerOrderId);
    if (!existing || existing.executionIntentId !== command.executionIntentId)
      return invalid(command, 'PAPER order reference does not match an existing execution intent');
    if (existing.status === 'CANCELLED')
      return invalid(command, 'Cancelled PAPER orders cannot be replaced');
    if (
      command.quantity !== undefined &&
      (!Number.isFinite(command.quantity) || command.quantity <= 0)
    )
      return invalid(command, 'Replacement quantity must be positive');
    if (
      command.limitPrice !== undefined &&
      (!Number.isFinite(command.limitPrice) || command.limitPrice <= 0)
    )
      return invalid(command, 'Replacement limit price must be positive');
    if (command.quantity !== undefined) existing.quantity = command.quantity;
    if (command.limitPrice !== undefined) existing.limitPrice = command.limitPrice;
    existing.status = 'REPLACED';
    return {
      ok: true,
      operation: 'REPLACE',
      status: 'REPLACED',
      executionIntentId: command.executionIntentId,
      correlationId: command.authorization.correlationId,
      idempotencyKey: command.authorization.idempotencyKey,
      providerOrderId: command.providerOrderId,
      clientRequestId: command.clientRequestId,
      filledQuantity: existing.filledQuantity,
      providerStatus: 'PAPER_REPLACED',
    };
  }
}
