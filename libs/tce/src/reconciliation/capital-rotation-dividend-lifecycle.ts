import type { TceDividendLifecycle, TceLifecycleState } from '@tce/contracts';

export type CapitalRotationLifecycleState =
  | 'HOLDING'
  | 'EX_DIVIDEND'
  | 'T2_PENDING'
  | 'DIVIDEND_CONFIRMED'
  | 'EXIT_READY'
  | 'CLOSED'
  | 'SLOT_RECYCLED';

export type CapitalRotationLifecyclePosition = Readonly<{
  positionId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice?: number;
  dividendPerShare?: number;
  exDividendAt?: string;
  paymentAt?: string;
  dividendLifecycle: TceDividendLifecycle;
  state: CapitalRotationLifecycleState;
  updatedAt: string;
}>;

export type CapitalRotationLifecycleEvent = Readonly<{
  positionId: string;
  from: CapitalRotationLifecycleState;
  to: CapitalRotationLifecycleState;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  reason: string;
  dividendEvidence?: {
    exDividendAt?: string;
    paymentAt?: string;
    netCash?: number;
  };
}>;

export type CapitalRotationLifecycleOutcome =
  | Readonly<{
      ok: true;
      position: CapitalRotationLifecyclePosition;
      event: CapitalRotationLifecycleEvent;
    }>
  | Readonly<{ ok: false; code: string; message: string }>;

const allowed: Record<
  CapitalRotationLifecycleState,
  readonly CapitalRotationLifecycleState[]
> = {
  HOLDING: ['EX_DIVIDEND', 'EXIT_READY', 'CLOSED'],
  EX_DIVIDEND: ['T2_PENDING'],
  T2_PENDING: ['DIVIDEND_CONFIRMED', 'EXIT_READY'],
  DIVIDEND_CONFIRMED: ['EXIT_READY'],
  EXIT_READY: ['CLOSED'],
  CLOSED: ['SLOT_RECYCLED'],
  SLOT_RECYCLED: ['HOLDING'],
};

export class CapitalRotationDividendLifecycle {
  private readonly processed = new Set<string>();

  transition(
    position: CapitalRotationLifecyclePosition,
    to: CapitalRotationLifecycleState,
    identity: { correlationId: string; idempotencyKey: string },
    reason: string,
    evidence?: CapitalRotationLifecycleEvent['dividendEvidence'],
  ): CapitalRotationLifecycleOutcome {
    if (!identity.correlationId.trim() || !identity.idempotencyKey.trim()) {
      return {
        ok: false,
        code: 'INVALID_IDENTITY',
        message: 'Lifecycle correlationId and idempotencyKey are required',
      };
    }
    if (!reason.trim()) {
      return {
        ok: false,
        code: 'INVALID_REASON',
        message: 'Lifecycle transition reason is required',
      };
    }

    if (this.processed.has(identity.idempotencyKey)) {
      return {
        ok: true,
        position,
        event: {
          positionId: position.positionId,
          from: position.state,
          to: position.state,
          correlationId: identity.correlationId,
          idempotencyKey: identity.idempotencyKey,
          occurredAt: position.updatedAt,
          reason: 'idempotent_replay',
        },
      };
    }

    if (!allowed[position.state].includes(to)) {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        message: position.state + ' cannot transition to ' + to,
      };
    }
    if (to === 'T2_PENDING') {
      if (position.state !== 'EX_DIVIDEND') {
        return {
          ok: false,
          code: 'EX_DATE_REQUIRED',
          message: 'T2_PENDING requires EX_DIVIDEND state first',
        };
      }
    }
    if (to === 'DIVIDEND_CONFIRMED') {
      if (position.state !== 'T2_PENDING') {
        return {
          ok: false,
          code: 'T2_REQUIRED',
          message: 'Dividend confirmation requires T2_PENDING',
        };
      }
      if (position.paymentAt && Date.parse(position.paymentAt) > Date.now()) {
        return {
          ok: false,
          code: 'PAYMENT_NOT_DUE',
          message: 'Dividend confirmation is not due yet',
        };
      }
    }

    const now = new Date().toISOString();
    const next: CapitalRotationLifecyclePosition = {
      ...position,
      state: to,
      dividendLifecycle:
        to === 'EX_DIVIDEND'
          ? 'EX_DIVIDEND'
          : to === 'T2_PENDING'
            ? 'T2_PENDING'
            : to === 'DIVIDEND_CONFIRMED'
              ? 'DIVIDEND_CONFIRMED'
              : position.dividendLifecycle,
      updatedAt: now,
    };

    const event: CapitalRotationLifecycleEvent = {
      positionId: position.positionId,
      from: position.state,
      to,
      correlationId: identity.correlationId,
      idempotencyKey: identity.idempotencyKey,
      occurredAt: now,
      reason,
      dividendEvidence: evidence,
    };

    this.processed.add(identity.idempotencyKey);
    return { ok: true, position: next, event };
  }
}

export function expectedT2Window(exDividendAt: string): string | undefined {
  const ex = Date.parse(exDividendAt);
  if (!Number.isFinite(ex)) return undefined;
  return new Date(ex + 2 * 86_400_000).toISOString();
}

export function lifecycleStateFromDividend(
  lifecycle: TceDividendLifecycle,
): CapitalRotationLifecycleState | undefined {
  switch (lifecycle) {
    case 'EX_DIVIDEND':
      return 'EX_DIVIDEND';
    case 'T2_PENDING':
      return 'T2_PENDING';
    case 'DIVIDEND_CONFIRMED':
      return 'DIVIDEND_CONFIRMED';
    default:
      return undefined;
  }
}

export function isLifecycleState(value: string): value is TceLifecycleState {
  return (
    value === 'HOLDING' ||
    value === 'EX_DIVIDEND' ||
    value === 'T2_PENDING' ||
    value === 'DIVIDEND_CONFIRMED' ||
    value === 'EXIT_READY' ||
    value === 'CLOSED' ||
    value === 'SLOT_RECYCLED'
  );
}
