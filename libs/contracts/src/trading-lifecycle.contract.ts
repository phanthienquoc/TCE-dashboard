import type { TceExecutionMode } from './tce-execution.contract.js';

export type TceLifecycleState =
  | 'CANDIDATE'
  | 'APPROVED'
  | 'PLANNED'
  | 'RISK_CHECKED'
  | 'READY'
  | 'ORDER_SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'HOLDING'
  | 'EX_DIVIDEND'
  | 'T2_PENDING'
  | 'DIVIDEND_CONFIRMED'
  | 'EXIT_READY'
  | 'EXIT_SUBMITTED'
  | 'CLOSED'
  | 'SLOT_RECYCLED';

export type TceLifecycleEvent = {
  state: TceLifecycleState;
  timestamp: string;
  correlationId: string;
  idempotencyKey?: string;
  reason?: string;
};

export type TceExecutionIdentity = {
  correlationId: string;
  idempotencyKey: string;
};

export type TceLifecycleAuditRecord = TceLifecycleEvent & {
  engine: string;
  symbol?: string;
  pool?: string;
  slot?: string;
  actor: 'ENGINE' | 'USER' | 'SCHEDULER' | 'PROVIDER';
  metadata?: Record<string, unknown>;
};

export const TCE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<TceLifecycleState, readonly TceLifecycleState[]>
> = {
  CANDIDATE: ['APPROVED'],
  APPROVED: ['PLANNED'],
  PLANNED: ['RISK_CHECKED'],
  RISK_CHECKED: ['READY'],
  READY: ['ORDER_SUBMITTED'],
  ORDER_SUBMITTED: ['PARTIALLY_FILLED', 'FILLED'],
  PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED'],
  FILLED: ['HOLDING'],
  HOLDING: ['EX_DIVIDEND', 'EXIT_READY', 'CLOSED'],
  EX_DIVIDEND: ['T2_PENDING'],
  T2_PENDING: ['DIVIDEND_CONFIRMED', 'EXIT_READY'],
  DIVIDEND_CONFIRMED: ['EXIT_READY'],
  EXIT_READY: ['EXIT_SUBMITTED'],
  EXIT_SUBMITTED: ['CLOSED'],
  CLOSED: ['SLOT_RECYCLED'],
  SLOT_RECYCLED: ['CANDIDATE'],
};

export function canTransitionLifecycle(from: TceLifecycleState, to: TceLifecycleState): boolean {
  return TCE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

// Keep the import part of this module's public dependency graph without re-declaring
// TceExecutionMode; the canonical execution mode is exported by tce-execution.contract.
export type { TceExecutionMode };
