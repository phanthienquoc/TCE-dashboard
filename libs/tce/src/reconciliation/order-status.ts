import type { TceOrderState } from '@tce/contracts';

const STATUS_MAP: Readonly<Record<string, TceOrderState>> = {
  NEW: 'SUBMITTED',
  PENDING_NEW: 'SUBMITTED',
  OPEN: 'SUBMITTED',
  WORKING: 'SUBMITTED',
  ACCEPTED: 'SUBMITTED',
  RS: 'SUBMITTED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  PARTIAL_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCEL_PENDING: 'CANCEL_PENDING',
  PENDING_CANCEL: 'CANCEL_PENDING',
  CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
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
