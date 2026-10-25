import type { DrePositionState, RollingPosition } from './dre.types';

export const CURRENT_POSITION_STATES: ReadonlySet<DrePositionState> = new Set([
  'BUY_PENDING',
  'BOUGHT',
  'T+2_PENDING',
  'AVAILABLE',
  'TP_REACHED',
  'SELL_APPROVED',
  'SELL_PENDING',
  'SOLD',
]);

export const TERMINAL_POSITION_STATES: ReadonlySet<DrePositionState> = new Set([
  'COMPLETED',
  'MISSED',
]);

const ALLOWED_TRANSITIONS: Record<DrePositionState, ReadonlySet<DrePositionState>> = {
  PLANNED: new Set(['NEXT', 'MISSED']),
  NEXT: new Set(['BUY_PENDING', 'MISSED']),
  BUY_PENDING: new Set(['BOUGHT', 'MISSED']),
  BOUGHT: new Set(['T+2_PENDING', 'AVAILABLE', 'MISSED']),
  'T+2_PENDING': new Set(['AVAILABLE', 'MISSED']),
  AVAILABLE: new Set(['TP_REACHED', 'MISSED']),
  TP_REACHED: new Set(['SELL_APPROVED']),
  SELL_APPROVED: new Set(['SELL_PENDING', 'SOLD']),
  SELL_PENDING: new Set(['SOLD', 'MISSED']),
  SOLD: new Set(['COMPLETED']),
  COMPLETED: new Set(),
  MISSED: new Set(),
};

export function assertPositionTransition(from: DrePositionState, to: DrePositionState): void {
  if (!ALLOWED_TRANSITIONS[from].has(to))
    throw new Error(`Invalid DRE position transition: ${from} -> ${to}`);
}

export function nextSequence(positions: RollingPosition[]): number {
  return positions.reduce((max, position) => Math.max(max, position.sequence), 0) + 1;
}

export function positionId(campaignId: string, sequence: number): string {
  return `${campaignId}:#${String(sequence).padStart(2, '0')}`;
}

export function getCurrentPosition(positions: RollingPosition[]): RollingPosition | null {
  return (
    [...positions]
      .filter(position => CURRENT_POSITION_STATES.has(position.state))
      .sort((a, b) => b.sequence - a.sequence)[0] ?? null
  );
}

export function getNextPosition(positions: RollingPosition[]): RollingPosition | null {
  return (
    [...positions]
      .filter(position => position.state === 'NEXT')
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}
