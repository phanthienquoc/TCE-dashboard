import assert from 'node:assert/strict';
import test from 'node:test';
import type { TceExecutionSubmitCommand } from '@tce/contracts';
import { TcePaperExecutionPort } from './paper-execution.js';

const authorization = {
  approvalId: 'paper-approval',
  approvedAt: '2026-09-10T06:00:00.000Z',
  correlationId: 'corr-paper',
  idempotencyKey: 'idem-paper',
};

const submit = (overrides: Partial<TceExecutionSubmitCommand> = {}): TceExecutionSubmitCommand => ({
  operation: 'SUBMIT',
  accountId: 'account-1',
  environment: 'paper',
  mode: 'PAPER',
  authorization,
  intent: {
    id: 'intent-paper',
    orderPlanId: 'plan-paper',
    correlationId: authorization.correlationId,
    idempotencyKey: authorization.idempotencyKey,
    mode: 'PAPER',
    symbol: 'DPM',
    side: 'BUY',
    quantity: 300,
    limitPrice: 28_500,
    lifecycleState: 'READY',
    createdAt: authorization.approvedAt,
  },
  clientRequestId: 'client-paper',
  ...overrides,
});

test('submits a deterministic PAPER order without provider access', async () => {
  const port = new TcePaperExecutionPort();
  const first = await port.submit(submit());
  const second = await port.submit(submit());

  assert.equal(first.ok, true);
  assert.equal(first.status, 'SUBMITTED');
  assert.equal(first.providerStatus, 'PAPER_ACCEPTED');
  assert.match(first.providerOrderId ?? '', /^paper-[0-9a-f]{16}$/);
  assert.deepEqual(second, first);
});

test('rejects non-PAPER submission at the PAPER port', async () => {
  const result = await new TcePaperExecutionPort().submit(submit({ mode: 'LIVE' }));
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'INVALID_COMMAND');
});

test('cancels and replaces only the matching PAPER order', async () => {
  const port = new TcePaperExecutionPort();
  const created = await port.submit(submit());
  const providerOrderId = created.providerOrderId!;

  const replaced = await port.replace({
    operation: 'REPLACE',
    accountId: 'account-1',
    environment: 'paper',
    mode: 'PAPER',
    authorization: { ...authorization, idempotencyKey: 'idem-replace' },
    executionIntentId: 'intent-paper',
    providerOrderId,
    clientRequestId: 'client-replace',
    quantity: 600,
    limitPrice: 28_400,
  });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.status, 'REPLACED');

  const cancelled = await port.cancel({
    operation: 'CANCEL',
    accountId: 'account-1',
    environment: 'paper',
    mode: 'PAPER',
    authorization: { ...authorization, idempotencyKey: 'idem-cancel' },
    executionIntentId: 'intent-paper',
    providerOrderId,
    clientRequestId: 'client-cancel',
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.status, 'CANCELLED');
});

test('fails closed for unknown or cancelled PAPER orders', async () => {
  const port = new TcePaperExecutionPort();
  const unknown = await port.cancel({
    operation: 'CANCEL',
    accountId: 'account-1',
    environment: 'paper',
    mode: 'PAPER',
    authorization,
    executionIntentId: 'missing',
    providerOrderId: 'paper-missing',
    clientRequestId: 'client-cancel',
  });
  assert.equal(unknown.error?.code, 'INVALID_ORDER');

  const created = await port.submit(submit());
  await port.cancel({
    operation: 'CANCEL',
    accountId: 'account-1',
    environment: 'paper',
    mode: 'PAPER',
    authorization: { ...authorization, idempotencyKey: 'idem-cancel-first' },
    executionIntentId: 'intent-paper',
    providerOrderId: created.providerOrderId,
    clientRequestId: 'client-cancel-first',
  });
  const replaced = await port.replace({
    operation: 'REPLACE',
    accountId: 'account-1',
    environment: 'paper',
    mode: 'PAPER',
    authorization: { ...authorization, idempotencyKey: 'idem-replace-after-cancel' },
    executionIntentId: 'intent-paper',
    providerOrderId: created.providerOrderId!,
    clientRequestId: 'client-replace-after-cancel',
    quantity: 100,
  });
  assert.equal(replaced.error?.code, 'INVALID_ORDER');
});
