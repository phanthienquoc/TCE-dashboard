import { describe, expect, it } from 'vitest';
import { advanceDividendPositionLifecycle } from './position-dividend-lifecycle.js';

describe('advanceDividendPositionLifecycle', () => {
  const base = {
    positionState: 'HOLDING' as const,
    dividendLifecycle: 'ELIGIBLE' as const,
    authoritative: true,
    observedAt: '2026-09-14T09:00:00.000Z',
    exDividendAt: '2026-09-14T09:00:00.000Z',
  };

  it('moves authoritative HOLDING to EX_DIVIDEND at the boundary', () => {
    expect(advanceDividendPositionLifecycle(base)).toEqual({
      positionState: 'EX_DIVIDEND',
      dividendLifecycle: 'EX_DIVIDEND',
      transitioned: true,
      reason: 'EX_DIVIDEND_BOUNDARY_REACHED',
    });
  });

  it('fails closed when reconciliation is not authoritative', () => {
    expect(advanceDividendPositionLifecycle({ ...base, authoritative: false })).toEqual({
      positionState: 'HOLDING',
      dividendLifecycle: 'ELIGIBLE',
      transitioned: false,
      reason: 'AUTHORITATIVE_RECONCILIATION_REQUIRED',
    });
  });

  it('does not cross the ex-dividend boundary early', () => {
    expect(
      advanceDividendPositionLifecycle({
        ...base,
        observedAt: '2026-09-14T08:59:59.999Z',
      }),
    ).toEqual({
      positionState: 'HOLDING',
      dividendLifecycle: 'ELIGIBLE',
      transitioned: false,
      reason: 'NO_DIVIDEND_POSITION_TRANSITION',
    });
  });

  it('advances EX_DIVIDEND to T2_PENDING only from the expected reconciled state', () => {
    expect(
      advanceDividendPositionLifecycle({
        ...base,
        positionState: 'EX_DIVIDEND',
        dividendLifecycle: 'EX_DIVIDEND',
      }),
    ).toEqual({
      positionState: 'T2_PENDING',
      dividendLifecycle: 'T2_PENDING',
      transitioned: true,
      reason: 'T2_SETTLEMENT_RECONCILIATION_PENDING',
    });
  });

  it('rejects malformed lifecycle timestamps without mutation', () => {
    expect(
      advanceDividendPositionLifecycle({
        ...base,
        observedAt: 'not-a-date',
      }),
    ).toEqual({
      positionState: 'HOLDING',
      dividendLifecycle: 'ELIGIBLE',
      transitioned: false,
      reason: 'INVALID_LIFECYCLE_TIMESTAMP',
    });
  });
});
