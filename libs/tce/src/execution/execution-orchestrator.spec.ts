import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  TceExecutionIdempotencyRecord,
  TceExecutionIdempotencyReservation,
  TceExecutionIdempotencyStore,
  TceExecutionPort,
  TceExecutionResult,
  TceExecutionSubmitCommand,
} from '@tce/contracts';
import { TceExecutionOrchestrator } from './execution-orchestrator.js';

const submit = (overrides: Partial<TceExecutionSubmitCommand> = {}): TceExecutionSubmitCommand => ({
  operation: 'SUBMIT',
  accountId: 'account-1',
  environment: 'production',
  mode: 'LIVE',
  authorization: {
    approvalId: 'approval-1',
    approvedAt: '2026-09-10T06:00:00.000Z',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
  },
  intent: {
    id: 'intent-1',
    orderPlanId: 'plan-1',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    mode: 'LIVE',
    symbol: 'DPM',
    side: 'BUY',
    quantity: 300,
    limitPrice: 28_500,
    lifecycleState: 'READY',
    createdAt: '2026-09-10T06:00:00.000Z',
  },
  clientRequestId: 'client-1',
  ...overrides,
});

const okResult = (command: TceExecutionSubmitCommand): TceExecutionResult => ({
  ok: true,
  operation: 'SUBMIT',
  status: 'SUBMITTED',
  executionIntentId: command.intent.id,
  correlationId: command.authorization.correlationId,
  idempotencyKey: command.authorization.idempotencyKey,
  clientRequestId: command.clientRequestId,
  providerOrderId: 'ssi-1',
});

function memoryStore(): TceExecutionIdempotencyStore {
  const rows = new Map<string, TceExecutionIdempotencyRecord>();
  const key = (r: TceExecutionIdempotencyReservation) =>
    [r.scope.accountId, r.scope.environment, r.scope.idempotencyKey].join('|');
  return {
    async reserve(reservation) {
      const k = key(reservation);
      const existing = rows.get(k);
      if (existing) {
        return {
          kind:
            existing.reservation.fingerprint === reservation.fingerprint
              ? 'EXISTING'
              : 'FINGERPRINT_CONFLICT',
          record: existing,
        };
      }
      const record: TceExecutionIdempotencyRecord = {
        reservation,
        status: 'PENDING',
        updatedAt: reservation.createdAt,
      };
      rows.set(k, record);
      return { kind: 'RESERVED', record };
    },
    async complete(scope, fingerprint, result, updatedAt) {
      const k = [scope.accountId, scope.environment, scope.idempotencyKey].join('|');
      const existing = rows.get(k);
      if (!existing || existing.reservation.fingerprint !== fingerprint) {
        throw new Error('no matching reservation');
      }
      const record = {
        ...existing,
        status:
          result.status === 'UNKNOWN' || result.error?.reconciliationRequired
            ? ('UNKNOWN' as const)
            : ('COMPLETED' as const),
        result,
        updatedAt,
      };
      rows.set(k, record);
      return record;
    },
  };
}

test('dispatches approved submit and preserves provider-neutral result', async () => {
  let calls = 0;
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };

  const result = await new TceExecutionOrchestrator(port).execute(submit());
  assert.equal(result.ok, true);
  assert.equal(result.result.providerOrderId, 'ssi-1');
  assert.equal(calls, 1);
});

test('deduplicates repeated idempotency keys without calling provider twice', async () => {
  let calls = 0;
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port);
  const first = await orchestrator.execute(submit());
  const second = await orchestrator.execute(submit());
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('rejects reuse of the same idempotency key for a different command fingerprint', async () => {
  let calls = 0;
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port);
  await orchestrator.execute(submit());
  const conflicting = submit({
    intent: { ...submit().intent, quantity: 600 },
  });
  const result = await orchestrator.execute(conflicting);
  assert.equal(result.ok, false);
  assert.equal(result.result.error?.code, 'DUPLICATE_REQUEST');
  assert.equal(calls, 1);
});

test('uses durable store scope and never redispatches an existing pending key', async () => {
  let calls = 0;
  const store = memoryStore();
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port, {
    idempotencyStore: store,
    now: () => new Date('2026-10-21T12:00:00.000Z'),
  });
  const first = await orchestrator.execute(submit());
  const second = await orchestrator.execute(submit());
  assert.equal(first.result.status, 'SUBMITTED');
  assert.equal(second.result.status, 'SUBMITTED');
  assert.equal(calls, 1);

  const otherAccount = submit({
    accountId: 'account-2',
    intent: { ...submit().intent, id: 'intent-2' },
  });
  const third = await orchestrator.execute(otherAccount);
  assert.equal(third.result.status, 'SUBMITTED');
  assert.equal(calls, 2);
});

test('fails closed when authorization does not match the intent', async () => {
  const port: TceExecutionPort = {
    submit: async () => {
      throw new Error('must not be called');
    },
    cancel: async () => {
      throw new Error('must not be called');
    },
    replace: async () => {
      throw new Error('must not be called');
    },
  };
  const result = await new TceExecutionOrchestrator(port).execute(
    submit({ authorization: { ...submit().authorization, correlationId: 'other-correlation' } })
  );
  assert.equal(result.ok, false);
  assert.equal(result.result.error?.code, 'INVALID_COMMAND');
});

test('normalizes adapter exceptions as unknown and requires reconciliation', async () => {
  const port: TceExecutionPort = {
    submit: async () => {
      throw new Error('network timeout');
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const result = await new TceExecutionOrchestrator(port).execute(submit());
  assert.equal(result.result.status, 'UNKNOWN');
  assert.equal(result.result.error?.code, 'UNKNOWN');
  assert.equal(result.result.error?.reconciliationRequired, true);
});

test('durable store rejection due to conflicting fingerprint never reaches provider', async () => {
  const store = memoryStore();
  const port: TceExecutionPort = {
    submit: async command => okResult(command),
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port, { idempotencyStore: store });
  await orchestrator.execute(submit());
  const conflicting = await orchestrator.execute(
    submit({
      intent: { ...submit().intent, limitPrice: 29_000 },
    })
  );
  assert.equal(conflicting.result.error?.code, 'DUPLICATE_REQUEST');
});

test('does not dispatch when durable reservation fails and returns a retryable pre-dispatch result', async () => {
  let calls = 0;
  const store: TceExecutionIdempotencyStore = {
    reserve: async () => {
      throw new Error('table missing');
    },
    complete: async () => {
      throw new Error('must not be called');
    },
  };
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };

  const result = await new TceExecutionOrchestrator(port, { idempotencyStore: store }).execute(
    submit()
  );
  assert.equal(calls, 0);
  assert.equal(result.result.status, 'REJECTED');
  assert.equal(result.result.error?.code, 'PROVIDER_UNAVAILABLE');
  assert.equal(result.result.error?.retryable, true);
  assert.equal(result.result.error?.reconciliationRequired, false);
});

test('returns UNKNOWN when dispatch succeeded but durable result persistence fails', async () => {
  let calls = 0;
  const store: TceExecutionIdempotencyStore = {
    reserve: async reservation => ({
      kind: 'RESERVED',
      record: { reservation, status: 'PENDING', updatedAt: reservation.createdAt },
    }),
    complete: async () => {
      throw new Error('database unavailable');
    },
  };
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return okResult(command);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };

  const result = await new TceExecutionOrchestrator(port, { idempotencyStore: store }).execute(
    submit()
  );
  assert.equal(calls, 1);
  assert.equal(result.ok, false);
  assert.equal(result.result.status, 'UNKNOWN');
  assert.equal(result.result.error?.reconciliationRequired, true);
});

test('existing PENDING reservation requires reconciliation and never redispatches', async () => {
  let calls = 0;
  const command = submit();
  const reservation: TceExecutionIdempotencyReservation = {
    scope: {
      accountId: command.accountId,
      environment: command.environment,
      idempotencyKey: command.authorization.idempotencyKey,
    },
    fingerprint: 'same-fingerprint',
    executionIntentId: command.intent.id,
    correlationId: command.authorization.correlationId,
    clientRequestId: command.clientRequestId,
    createdAt: '2026-10-21T12:00:00.000Z',
  };
  const store: TceExecutionIdempotencyStore = {
    reserve: async () => ({
      kind: 'EXISTING',
      record: { reservation, status: 'PENDING', updatedAt: reservation.createdAt },
    }),
    complete: async () => {
      throw new Error('must not be called');
    },
  };
  const port: TceExecutionPort = {
    submit: async providerCommand => {
      calls += 1;
      return okResult(providerCommand);
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };

  const result = await new TceExecutionOrchestrator(port, { idempotencyStore: store }).execute(
    command
  );
  assert.equal(calls, 0);
  assert.equal(result.result.status, 'PENDING');
  assert.equal(result.result.error?.reconciliationRequired, true);
});

test('durable timeout outcome is persisted as UNKNOWN and duplicate request never redispatches', async () => {
  let calls = 0;
  const store = memoryStore();
  const port: TceExecutionPort = {
    submit: async () => {
      calls += 1;
      throw new Error('provider timed out after dispatch');
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port, {
    idempotencyStore: store,
    now: () => new Date('2026-10-21T12:00:00.000Z'),
  });

  const first = await orchestrator.execute(submit());
  assert.equal(first.ok, false);
  assert.equal(first.result.status, 'UNKNOWN');
  assert.equal(first.result.error?.reconciliationRequired, true);

  const second = await orchestrator.execute(submit());
  assert.equal(second.ok, false);
  assert.equal(second.result.status, 'UNKNOWN');
  assert.equal(second.result.error?.reconciliationRequired, true);
  assert.equal(calls, 1);
});

test('unconfirmed provider submissions require reconciliation and duplicate requests never redispatch', async () => {
  let calls = 0;
  const store = memoryStore();
  const port: TceExecutionPort = {
    submit: async command => {
      calls += 1;
      return {
        ok: false,
        operation: 'SUBMIT',
        status: 'PENDING',
        executionIntentId: command.intent.id,
        correlationId: command.authorization.correlationId,
        idempotencyKey: command.authorization.idempotencyKey,
        clientRequestId: command.clientRequestId,
        providerOrderId: 'ssi-pending',
        providerStatus: 'WAIT',
        error: {
          code: 'UNKNOWN',
          message: 'SSI has not confirmed the submitted order; reconciliation is required',
          retryable: false,
          reconciliationRequired: true,
        },
      };
    },
    cancel: async () => {
      throw new Error('not used');
    },
    replace: async () => {
      throw new Error('not used');
    },
  };
  const orchestrator = new TceExecutionOrchestrator(port, { idempotencyStore: store });

  const first = await orchestrator.execute(submit());
  assert.equal(first.ok, false);
  assert.equal(first.result.status, 'PENDING');
  assert.equal(first.result.error?.reconciliationRequired, true);

  const second = await orchestrator.execute(submit());
  assert.equal(second.ok, false);
  assert.equal(second.result.status, 'PENDING');
  assert.equal(second.result.error?.reconciliationRequired, true);
  assert.equal(calls, 1);
});
