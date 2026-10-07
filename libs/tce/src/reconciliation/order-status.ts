import type { TceOrderState } from '@tce/contracts';

const STATUS_MAP: Readonly<Record<string, TceOrderState>> = {
  NEW: 'SUBMITTED',
  PD: 'SUBMITTED',
  WA: 'SUBMITTED',
  RS: 'SUBMITTED',
  SD: 'SUBMITTED',
  QU: 'SUBMITTED',
  WM: 'SUBMITTED',
  PENDING_NEW: 'SUBMITTED',
  OPEN: 'SUBMITTED',
  WORKING: 'SUBMITTED',
  ACCEPTED: 'SUBMITTED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  PARTIAL_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  FF: 'FILLED',
  FFPC: 'FILLED',
  CANCEL_PENDING: 'CANCEL_PENDING',
  WC: 'CANCEL_PENDING',
  PENDING_CANCEL: 'CANCEL_PENDING',
  CANCELED: 'CANCELLED',
  CL: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  RJ: 'REJECTED',
  EXPIRED: 'EXPIRED',
  EX: 'EXPIRED',
};

/**
 * Normalizes provider-reported order status into the provider-neutral TCE state.
 * Unknown statuses intentionally become UNKNOWN so reconciliation cannot silently
 * treat a new broker state as a safe terminal state.
 */
export function mapProviderOrderStatus(providerStatus: string): TceOrderState {
  const normalized = String(providerStatus ?? '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  return STATUS_MAP[normalized] ?? 'UNKNOWN';
}
