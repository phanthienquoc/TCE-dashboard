import { createHash } from 'node:crypto';
import type { TceExecutionCommand } from '@tce/contracts';

/**
 * Fingerprints the actual command scope and action while deliberately excluding
 * mutable authorization timestamps/IDs. A key cannot be reused for a different
 * account, environment, operation or order intent.
 */
export function fingerprintExecutionCommand(command: TceExecutionCommand): string {
  const payload =
    command.operation === 'SUBMIT'
      ? {
          operation: command.operation,
          accountId: command.accountId,
          environment: command.environment,
          mode: command.mode,
          intent: command.intent,
          clientRequestId: command.clientRequestId,
        }
      : command.operation === 'CANCEL'
        ? {
            operation: command.operation,
            accountId: command.accountId,
            environment: command.environment,
            mode: command.mode,
            executionIntentId: command.executionIntentId,
            providerOrderId: command.providerOrderId ?? null,
            clientRequestId: command.clientRequestId,
          }
        : {
            operation: command.operation,
            accountId: command.accountId,
            environment: command.environment,
            mode: command.mode,
            executionIntentId: command.executionIntentId,
            providerOrderId: command.providerOrderId,
            clientRequestId: command.clientRequestId,
            quantity: command.quantity ?? null,
            limitPrice: command.limitPrice ?? null,
          };

  return createHash('sha256').update(stableSerialize(payload)).digest('hex');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}
