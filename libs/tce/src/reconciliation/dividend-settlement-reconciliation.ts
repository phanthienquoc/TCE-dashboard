export type DividendSettlementState = 'T2_PENDING' | 'AVAILABLE';

export type AuthoritativeSettlementHolding = Readonly<{
  symbol: string;
  quantity: number;
  status: 'HOLDING';
}>;

export type DividendSettlementPosition = Readonly<{
  state: DividendSettlementState;
  symbol: string;
  quantity: number;
  availableAt: string;
}>;

export type DividendSettlementReconciliation =
  | Readonly<{ ok: true; state: 'AVAILABLE'; symbol: string; quantity: number }>
  | Readonly<{ ok: false; reason: string }>;

const symbolKey = (symbol: string): string => symbol.trim().toUpperCase();

export function reconcileDividendSettlementAvailability(
  position: DividendSettlementPosition,
  authoritative: AuthoritativeSettlementHolding | undefined,
  now: Date
): DividendSettlementReconciliation {
  if (position.state !== 'T2_PENDING') {
    return { ok: false, reason: 'Position is not T2_PENDING.' };
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return { ok: false, reason: 'Observation time is invalid.' };
  }
  const availableAt = Date.parse(position.availableAt);
  if (!Number.isFinite(availableAt)) {
    return { ok: false, reason: 'Settlement availability timestamp is invalid.' };
  }
  if (!authoritative || authoritative.status !== 'HOLDING') {
    return { ok: false, reason: 'Authoritative HOLDING position is missing.' };
  }

  const positionSymbol = symbolKey(position.symbol);
  const holdingSymbol = symbolKey(authoritative.symbol);
  if (!positionSymbol || positionSymbol !== holdingSymbol) {
    return { ok: false, reason: 'Authoritative holding symbol does not match the lifecycle position.' };
  }
  if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
    return { ok: false, reason: 'Lifecycle position quantity is invalid.' };
  }
  if (!Number.isFinite(authoritative.quantity) || authoritative.quantity <= 0) {
    return { ok: false, reason: 'Authoritative holding quantity is invalid.' };
  }
  if (authoritative.quantity !== position.quantity) {
    return { ok: false, reason: 'Authoritative holding quantity does not match the lifecycle position.' };
  }
  if (now.getTime() < availableAt) {
    return { ok: false, reason: 'Settlement availability boundary has not been reached.' };
  }

  return {
    ok: true,
    state: 'AVAILABLE',
    symbol: positionSymbol,
    quantity: authoritative.quantity,
  };
}
