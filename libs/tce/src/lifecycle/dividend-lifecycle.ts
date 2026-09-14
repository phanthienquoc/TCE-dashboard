import type { TceDividendEvent, TceDividendLifecycle } from '@tce/contracts';

const TRANSITIONS: Readonly<Record<TceDividendLifecycle, ReadonlySet<TceDividendLifecycle>>> = {
  UNKNOWN: new Set(['ANNOUNCED', 'INVALIDATED']),
  ANNOUNCED: new Set(['ELIGIBLE', 'EX_DIVIDEND', 'MISSED', 'INVALIDATED']),
  ELIGIBLE: new Set(['EX_DIVIDEND', 'MISSED', 'INVALIDATED']),
  EX_DIVIDEND: new Set(['T2_PENDING', 'MISSED', 'INVALIDATED']),
  T2_PENDING: new Set(['DIVIDEND_CONFIRMED', 'MISSED', 'INVALIDATED']),
  DIVIDEND_CONFIRMED: new Set(),
  MISSED: new Set(),
  INVALIDATED: new Set(),
};

export function assertDividendLifecycleTransition(
  from: TceDividendLifecycle,
  to: TceDividendLifecycle
): void {
  if (!TRANSITIONS[from].has(to)) {
    throw new Error(`Invalid TCE dividend lifecycle transition: ${from} -> ${to}`);
  }
}

export function isDividendEligibilityWindowOpen(event: TceDividendEvent, now: string): boolean {
  const nowMs = Date.parse(now);
  const exMs = Date.parse(event.exDividendAt);
  return Number.isFinite(nowMs) && Number.isFinite(exMs) && nowMs < exMs;
}

export function resolveDividendLifecycle(
  event: TceDividendEvent,
  now: string
): TceDividendLifecycle {
  const nowMs = Date.parse(now);
  const exMs = Date.parse(event.exDividendAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(exMs)) return 'INVALIDATED';

  if (event.paymentAt) {
    const paymentMs = Date.parse(event.paymentAt);
    if (!Number.isFinite(paymentMs)) return 'INVALIDATED';
    if (nowMs >= paymentMs) return 'DIVIDEND_CONFIRMED';
  }

  if (nowMs >= exMs) return 'EX_DIVIDEND';
  return event.eligibility?.length ? 'ELIGIBLE' : 'ANNOUNCED';
}
