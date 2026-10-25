import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  TceExecutionCancelCommand,
  TceExecutionReplaceCommand,
  TceExecutionSubmitCommand,
} from './tce-execution.contract';

test('models a provider-neutral submit command with guarded authorization', () => {
  const command: TceExecutionSubmitCommand = {
    operation: 'SUBMIT',
    accountId: 'account-1',
    environment: 'production',
    mode: 'LIVE',
    authorization: {
      approvalId: 'risk-approval:1',
      approvedAt: '2026-09-10T05:00:00.000Z',
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
      createdAt: '2026-09-10T05:00:00.000Z',
    },
    clientRequestId: 'client-1',
  };

  assert.equal(command.operation, 'SUBMIT');
  assert.equal(command.authorization.approvalId, 'risk-approval:1');
  assert.equal(command.clientRequestId, 'client-1');
});

test('models idempotent cancel and replace commands without provider DTOs', () => {
  const authorization = {
    approvalId: 'risk-approval:1',
    approvedAt: '2026-09-10T05:00:00.000Z',
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
  };
  const cancel: TceExecutionCancelCommand = {
    operation: 'CANCEL',
    accountId: 'account-1',
    environment: 'production',
    mode: 'ASSISTED',
    authorization,
    executionIntentId: 'intent-1',
    providerOrderId: 'provider-1',
    clientRequestId: 'client-cancel-1',
  };
  const replace: TceExecutionReplaceCommand = {
    operation: 'REPLACE',
    accountId: 'account-1',
    environment: 'production',
    mode: 'ASSISTED',
    authorization,
    executionIntentId: 'intent-1',
    providerOrderId: 'provider-1',
    clientRequestId: 'client-replace-1',
    quantity: 400,
    limitPrice: 28_600,
  };

  assert.equal(cancel.operation, 'CANCEL');
  assert.equal(replace.operation, 'REPLACE');
  assert.equal(replace.quantity, 400);
  assert.equal(replace.limitPrice, 28_600);
});
