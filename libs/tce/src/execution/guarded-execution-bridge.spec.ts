import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  TceExecutionIntent,
  TceExecutionPort,
  TceExecutionResult,
  TceRiskGateContext,
  TceRiskGateRequest,
} from '@tce/contracts';
import { TceGuardedExecutionBridge } from './guarded-execution-bridge';

const intent: TceExecutionIntent = {
  id: 'execution-intent:order-plan:decision-1:slot-1',
  orderPlanId: 'order-plan:decision-1:slot-1',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  mode: 'LIVE',
  symbol: 'DPM',
  side: 'BUY',
  quantity: 300,
  limitPrice: 28_500,
  lifecycleState: 'READY',
  createdAt: '2026-09-18T01:00:00.000Z',
};

const context: TceRiskGateContext = {
  now: '2026-09-18T01:00:10.000Z',
  availableCapital: 10_000_000,
  concurrentExposure: 0,
  poolExposure: { A: 0, B: 0, C: 0 },
  engineState: 'RUNNING',
  engineKillSwitch: false,
  killedPools: [],
  blockedSymbols: [],
};

const request = (overrides: Partial<TceRiskGateRequest> = {}): TceRiskGateRequest => ({
  intent,
  pool: 'A',
  riskAmount: 300_000,
  context,
  ...overrides,
});

const config = {
  maxRiskPerTrade: 500_000,
  maxConcurrentExposure: 20_000_000,
  maxIntentAgeMs: 60_000,
};

function fakePort(calls: { submit: number }): TceExecutionPort {
  const result: TceExecutionResult = {
    ok: true,
    operation: 'SUBMIT',
    status: 'SUBMITTED',
    executionIntentId: intent.id,
    correlationId: intent.correlationId,
    idempotencyKey: intent.idempotencyKey,
    providerOrderId: 'paper-or-provider-1',
    clientRequestId: 'cr-1',
  };
  return {
    submit: async () => {
      calls.submit += 1;
      return result;
    },
    cancel: async command => ({
      ...result,
      operation: 'CANCEL',
      status: 'REJECTED',
      executionIntentId: command.executionIntentId,
      error: {
        code: 'UNSUPPORTED_OPERATION',
        message: 'not used by this test',
        retryable: false,
        reconciliationRequired: false,
      },
    }),
    replace: async command => ({
      ...result,
      operation: 'REPLACE',
      status: 'REJECTED',
      executionIntentId: command.executionIntentId,
      error: {
        code: 'UNSUPPORTED_OPERATION',
        message: 'not used by this test',
        retryable: false,
        reconciliationRequired: false,
      },
    }),
  };
}

test('blocks execution before the provider port when the global kill switch is active', () => {
  const calls = { submit: 0 };
  const bridge = new TceGuardedExecutionBridge(fakePort(calls));
  const prepared = bridge.prepareSubmit(
    request({ context: { ...context, engineKillSwitch: true } }),
    config,
    { accountId: 'account-1', environment: 'production', clientRequestId: 'cr-1' }
  );

  assert.deepEqual(prepared, {
    ok: false,
    code: 'ENGINE_KILL_SWITCH',
    message: 'Global engine kill switch is active',
  });
  assert.equal(calls.submit, 0);
});

test('creates an execution command only from a risk-approved intent', () => {
  const bridge = new TceGuardedExecutionBridge(fakePort({ submit: 0 }));
  const prepared = bridge.prepareSubmit(
    request(),
    config,
    { accountId: 'account-1', environment: 'production', clientRequestId: 'cr-1' }
  );

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.command.operation, 'SUBMIT');
  assert.equal(prepared.command.authorization.approvalId, prepared.approved.approvalId);
  assert.equal(prepared.command.authorization.correlationId, intent.correlationId);
  assert.equal(prepared.command.authorization.idempotencyKey, intent.idempotencyKey);
  assert.equal(prepared.command.intent, intent);
});

test('preserves orchestrator idempotency across repeated approved execution', async () => {
  const calls = { submit: 0 };
  const bridge = new TceGuardedExecutionBridge(fakePort(calls));
  const prepared = bridge.prepareSubmit(
    request(),
    config,
    { accountId: 'account-1', environment: 'production', clientRequestId: 'cr-1' }
  );
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const first = await bridge.executeApproved(prepared.command);
  const second = await bridge.executeApproved(prepared.command);

  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(calls.submit, 1);
});
