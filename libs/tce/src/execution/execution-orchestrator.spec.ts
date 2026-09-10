import assert from 'node:assert/strict';
import test from 'node:test';
import type {
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
