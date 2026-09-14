import type { TceDividendLifecycle, TcePositionState } from '@tce/contracts';

export type DividendPositionLifecycleInput = {
  positionState: TcePositionState;
  dividendLifecycle: TceDividendLifecycle;
  authoritative: boolean;
  observedAt: string;
  exDividendAt: string;
};

export type DividendPositionLifecycleResult = {
  positionState: TcePositionState;
  dividendLifecycle: TceDividendLifecycle;
  transitioned: boolean;
  reason: string;
};

/**
 * Resolve the next dividend-position state without mutating provider/local state.
 * Reconciliation remains the source of truth: non-authoritative observations fail closed.
 */
export function advanceDividendPositionLifecycle(
  input: DividendPositionLifecycleInput,
): DividendPositionLifecycleResult {
  if (!input.authoritative) {
    return {
      positionState: input.positionState,
      dividendLifecycle: input.dividendLifecycle,
      transitioned: false,
      reason: 'AUTHORITATIVE_RECONCILIATION_REQUIRED',
    };
  }

  const observedAt = Date.parse(input.observedAt);
  const exDividendAt = Date.parse(input.exDividendAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(exDividendAt)) {
    return {
      positionState: input.positionState,
      dividendLifecycle: input.dividendLifecycle,
      transitioned: false,
      reason: 'INVALID_LIFECYCLE_TIMESTAMP',
    };
  }

  if (input.positionState === 'HOLDING' && observedAt >= exDividendAt) {
    return {
      positionState: 'EX_DIVIDEND',
      dividendLifecycle: 'EX_DIVIDEND',
      transitioned: true,
      reason: 'EX_DIVIDEND_BOUNDARY_REACHED',
    };
  }

  if (input.positionState === 'EX_DIVIDEND' && input.dividendLifecycle === 'EX_DIVIDEND') {
    return {
      positionState: 'T2_PENDING',
      dividendLifecycle: 'T2_PENDING',
      transitioned: true,
      reason: 'T2_SETTLEMENT_RECONCILIATION_PENDING',
    };
  }

  return {
    positionState: input.positionState,
    dividendLifecycle: input.dividendLifecycle,
    transitioned: false,
    reason: 'NO_DIVIDEND_POSITION_TRANSITION',
  };
}
