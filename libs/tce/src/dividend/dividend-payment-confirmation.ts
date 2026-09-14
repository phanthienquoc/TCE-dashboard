import type { TceDividendLifecycle, TcePositionState } from '@tce/contracts';

export type DividendPaymentConfirmationInput = {
  positionState: TcePositionState;
  dividendLifecycle: TceDividendLifecycle;
  authoritative: boolean;
  positionSymbol: string;
  eventSymbol: string;
  eventId: string;
  observedAt: string;
  paymentAt?: string;
  paymentConfirmed: boolean;
  paymentEvidenceAt?: string;
  paymentEvidenceSource?: string;
};

export type DividendPaymentConfirmationResult = {
  positionState: TcePositionState;
  dividendLifecycle: TceDividendLifecycle;
  confirmed: boolean;
  transitioned: boolean;
  late: boolean;
  reason: string;
  eventId: string;
};

/**
 * Resolve dividend payment confirmation without mutating provider/local state.
 * Explicit source evidence is required; absence or malformed evidence fails closed.
 */
export function confirmDividendPayment(
  input: DividendPaymentConfirmationInput,
): DividendPaymentConfirmationResult {
  const unchanged = (reason: string, late = false): DividendPaymentConfirmationResult => ({
    positionState: input.positionState,
    dividendLifecycle: input.dividendLifecycle,
    confirmed: false,
    transitioned: false,
    late,
    reason,
    eventId: input.eventId,
  });

  if (!input.authoritative) {
    return unchanged('AUTHORITATIVE_RECONCILIATION_REQUIRED');
  }

  if (input.positionState !== 'T2_PENDING' || input.dividendLifecycle !== 'T2_PENDING') {
    return unchanged('T2_PENDING_LIFECYCLE_REQUIRED');
  }

  if (!input.eventId || !input.positionSymbol || !input.eventSymbol || input.positionSymbol !== input.eventSymbol) {
    return unchanged('DIVIDEND_EVENT_POSITION_MISMATCH');
  }

  const observedAt = Date.parse(input.observedAt);
  if (!Number.isFinite(observedAt)) {
    return unchanged('INVALID_OBSERVATION_TIMESTAMP');
  }

  if (!input.paymentConfirmed) {
    return unchanged('PAYMENT_CONFIRMATION_EVIDENCE_REQUIRED');
  }

  if (!input.paymentEvidenceAt || !input.paymentEvidenceSource?.trim()) {
    return unchanged('PAYMENT_CONFIRMATION_EVIDENCE_REQUIRED');
  }

  const evidenceAt = Date.parse(input.paymentEvidenceAt);
  if (!Number.isFinite(evidenceAt)) {
    return unchanged('INVALID_PAYMENT_EVIDENCE_TIMESTAMP');
  }

  if (evidenceAt > observedAt) {
    return unchanged('PAYMENT_EVIDENCE_AFTER_OBSERVATION');
  }

  let late = false;
  if (input.paymentAt) {
    const expectedPaymentAt = Date.parse(input.paymentAt);
    if (!Number.isFinite(expectedPaymentAt)) {
      return unchanged('INVALID_PAYMENT_TIMESTAMP');
    }
    late = evidenceAt > expectedPaymentAt;
  }

  return {
    positionState: 'AVAILABLE',
    dividendLifecycle: 'DIVIDEND_CONFIRMED',
    confirmed: true,
    transitioned: true,
    late,
    reason: late ? 'DIVIDEND_PAYMENT_CONFIRMED_LATE' : 'DIVIDEND_PAYMENT_CONFIRMED',
    eventId: input.eventId,
  };
}
