import type { TceDividendEvent } from '@tce/contracts';
import type { AuthoritativeHolding, AuthoritativeProjection } from '../reconciliation/authoritative-position-projection';

export type DividendHoldingEligibility = Readonly<{
  eligible: boolean;
  holding?: AuthoritativeHolding;
  reason: string;
}>;

const symbolKey = (symbol: string) => symbol.trim().toUpperCase();

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateDividendHoldingEligibility(
  projection: AuthoritativeProjection,
  event: TceDividendEvent,
  observedAt: string
): DividendHoldingEligibility {
  if (!projection.authoritative) {
    return { eligible: false, reason: 'Authoritative position reconciliation is required.' };
  }

  const eventId = event.id.trim();
  const eventSymbol = symbolKey(event.symbol);
  const exDividendAt = parseTimestamp(event.exDividendAt);
  const observedAtMs = parseTimestamp(observedAt);
  if (!eventId || !eventSymbol || exDividendAt === null || observedAtMs === null) {
    return { eligible: false, reason: 'Dividend event identity or date is invalid.' };
  }

  const holding = projection.holdings.find(position => symbolKey(position.symbol) === eventSymbol);
  if (!holding) {
    return { eligible: false, reason: `No authoritative HOLDING matches dividend event: ${eventSymbol}.` };
  }
  if (holding.status !== 'HOLDING') {
    return { eligible: false, reason: `Authoritative position is not HOLDING: ${eventSymbol}.` };
  }
  if (!Number.isFinite(holding.quantity) || holding.quantity <= 0) {
    return { eligible: false, reason: `Authoritative HOLDING quantity is invalid: ${eventSymbol}.` };
  }

  if (observedAtMs < exDividendAt) {
    return { eligible: false, holding, reason: `Dividend is not ex-dividend yet: ${eventSymbol}.` };
  }

  return { eligible: true, holding, reason: `Authoritative HOLDING is eligible at ex-dividend: ${eventSymbol}.` };
}
