export type DividendEventAnomalyStatus =
  | 'CONFIRMED'
  | 'MISSING_PENDING'
  | 'MISSING_MISSED'
  | 'LATE_CONFIRMED'
  | 'CORPORATE_ACTION_RECONCILIATION_REQUIRED';

export type DividendCorporateAction = {
  type: 'SPLIT' | 'BONUS';
  numerator: number;
  denominator: number;
};

export type DividendEventAnomalyInput = {
  authoritative: boolean;
  eventPresent: boolean;
  expectedPaymentAt: string;
  observedAt: string;
  paymentEvidenceAt?: string;
  corporateAction?: DividendCorporateAction;
  holdingQuantity?: number;
  holdingAveragePrice?: number;
};

export type DividendEventAnomalyResult = {
  status: DividendEventAnomalyStatus;
  actionable: boolean;
  late: boolean;
  reason: string;
  adjustedQuantity?: number;
  adjustedAveragePrice?: number;
};

/**
 * Resolve dividend-event anomalies without mutating provider or portfolio state.
 * Missing evidence remains pending until the expected payment boundary; after that
 * boundary it is explicitly marked missed. Corporate actions always require a
 * fresh authoritative reconciliation before any persisted position update.
 */
export function reconcileDividendEventAnomaly(
  input: DividendEventAnomalyInput,
): DividendEventAnomalyResult {
  if (!input.authoritative) {
    return {
      status: 'MISSING_PENDING',
      actionable: false,
      late: false,
      reason: 'AUTHORITATIVE_RECONCILIATION_REQUIRED',
    };
  }

  const expectedPaymentAt = Date.parse(input.expectedPaymentAt);
  const observedAt = Date.parse(input.observedAt);
  if (!Number.isFinite(expectedPaymentAt) || !Number.isFinite(observedAt)) {
    return {
      status: 'MISSING_PENDING',
      actionable: false,
      late: false,
      reason: 'INVALID_PAYMENT_TIMESTAMP',
    };
  }

  if (input.corporateAction) {
    const { numerator, denominator } = input.corporateAction;
    if (
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      numerator <= 0 ||
      denominator <= 0 ||
      !Number.isFinite(input.holdingQuantity) ||
      input.holdingQuantity <= 0 ||
      !Number.isFinite(input.holdingAveragePrice) ||
      input.holdingAveragePrice <= 0
    ) {
      return {
        status: 'MISSING_PENDING',
        actionable: false,
        late: false,
        reason: 'INVALID_CORPORATE_ACTION_RECONCILIATION_INPUT',
      };
    }

    const ratio = numerator / denominator;
    return {
      status: 'CORPORATE_ACTION_RECONCILIATION_REQUIRED',
      actionable: false,
      late: false,
      reason: 'CORPORATE_ACTION_REQUIRES_AUTHORITATIVE_RECONCILIATION',
      adjustedQuantity: input.holdingQuantity * ratio,
      adjustedAveragePrice: input.holdingAveragePrice / ratio,
    };
  }

  if (!input.eventPresent) {
    return observedAt >= expectedPaymentAt
      ? {
          status: 'MISSING_MISSED',
          actionable: false,
          late: false,
          reason: 'DIVIDEND_PAYMENT_EVIDENCE_MISSED',
        }
      : {
          status: 'MISSING_PENDING',
          actionable: false,
          late: false,
          reason: 'DIVIDEND_PAYMENT_EVIDENCE_PENDING',
        };
  }

  if (!input.paymentEvidenceAt) {
    return {
      status: 'MISSING_PENDING',
      actionable: false,
      late: false,
      reason: 'EXPLICIT_PAYMENT_EVIDENCE_REQUIRED',
    };
  }

  const paymentEvidenceAt = Date.parse(input.paymentEvidenceAt);
  if (!Number.isFinite(paymentEvidenceAt) || paymentEvidenceAt > observedAt) {
    return {
      status: 'MISSING_PENDING',
      actionable: false,
      late: false,
      reason: 'INVALID_PAYMENT_EVIDENCE_TIMESTAMP',
    };
  }

  if (paymentEvidenceAt > expectedPaymentAt) {
    return {
      status: 'LATE_CONFIRMED',
      actionable: true,
      late: true,
      reason: 'DIVIDEND_PAYMENT_CONFIRMED_LATE',
    };
  }

  return {
    status: 'CONFIRMED',
    actionable: true,
    late: false,
    reason: 'DIVIDEND_PAYMENT_CONFIRMED',
  };
}
