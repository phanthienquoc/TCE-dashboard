export type DividendLifecycleAuditState =
  | 'ANNOUNCED'
  | 'ELIGIBLE'
  | 'EX_DIVIDEND'
  | 'T2_PENDING'
  | 'AVAILABLE'
  | 'DIVIDEND_CONFIRMED'
  | 'MISSED'
  | 'INVALIDATED'
  | 'CORPORATE_ACTION_RECONCILIATION_REQUIRED';

export type DividendLifecycleAuditEvidence = Readonly<{
  accountId: string;
  environment: 'PAPER' | 'ASSISTED' | 'LIVE';
  eventId: string;
  symbol: string;
  state: DividendLifecycleAuditState;
  observedAt: string;
  sourceRevision: string;
  authoritative: boolean;
}>;

export type DividendLifecycleAuditRecord = Readonly<
  DividendLifecycleAuditEvidence & {
    auditId: string;
    evidenceHash: string;
  }
>;

export interface DividendLifecycleAuditPersistencePort {
  append(record: DividendLifecycleAuditRecord): Promise<'APPENDED' | 'DUPLICATE'>;
  list(accountId: string, environment: DividendLifecycleAuditEvidence['environment'], eventId: string): Promise<readonly DividendLifecycleAuditRecord[]>;
}

const TERMINAL_STATES = new Set<DividendLifecycleAuditState>([
  'DIVIDEND_CONFIRMED',
  'MISSED',
  'INVALIDATED',
]);

const ALLOWED_TRANSITIONS: Readonly<Record<DividendLifecycleAuditState, readonly DividendLifecycleAuditState[]>> = {
  ANNOUNCED: ['ELIGIBLE', 'INVALIDATED'],
  ELIGIBLE: ['EX_DIVIDEND', 'INVALIDATED'],
  EX_DIVIDEND: ['T2_PENDING', 'CORPORATE_ACTION_RECONCILIATION_REQUIRED', 'INVALIDATED'],
  T2_PENDING: ['AVAILABLE', 'DIVIDEND_CONFIRMED', 'MISSED', 'CORPORATE_ACTION_RECONCILIATION_REQUIRED', 'INVALIDATED'],
  AVAILABLE: ['DIVIDEND_CONFIRMED', 'MISSED', 'CORPORATE_ACTION_RECONCILIATION_REQUIRED', 'INVALIDATED'],
  DIVIDEND_CONFIRMED: [],
  MISSED: [],
  INVALIDATED: [],
  CORPORATE_ACTION_RECONCILIATION_REQUIRED: ['EX_DIVIDEND', 'T2_PENDING', 'AVAILABLE', 'INVALIDATED'],
};

function canonicalize(evidence: DividendLifecycleAuditEvidence): string {
  return [
    evidence.accountId.trim(),
    evidence.environment,
    evidence.eventId.trim(),
    evidence.symbol.trim().toUpperCase(),
    evidence.state,
    evidence.observedAt,
    evidence.sourceRevision.trim(),
    String(evidence.authoritative),
  ].join('|');
}

/** Deterministic FNV-1a hash; no crypto/provider dependency is required. */
export function deterministicEvidenceHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildDividendLifecycleAuditRecord(
  evidence: DividendLifecycleAuditEvidence,
): DividendLifecycleAuditRecord | undefined {
  if (
    !evidence.authoritative ||
    !evidence.accountId.trim() ||
    !evidence.eventId.trim() ||
    !evidence.symbol.trim() ||
    !evidence.sourceRevision.trim() ||
    !Number.isFinite(Date.parse(evidence.observedAt))
  ) {
    return undefined;
  }

  const canonical = canonicalize(evidence);
  const evidenceHash = deterministicEvidenceHash(canonical);
  return {
    ...evidence,
    symbol: evidence.symbol.trim().toUpperCase(),
    auditId: `${evidence.accountId.trim()}:${evidence.environment}:${evidence.eventId.trim()}:${evidenceHash}`,
    evidenceHash,
  };
}

export function validateDividendLifecycleAuditTransition(
  previous: DividendLifecycleAuditRecord | undefined,
  next: DividendLifecycleAuditRecord,
): boolean {
  if (!next.authoritative) return false;
  if (!previous) return next.state === 'ANNOUNCED' || next.state === 'ELIGIBLE';
  if (
    previous.accountId !== next.accountId ||
    previous.environment !== next.environment ||
    previous.eventId !== next.eventId ||
    previous.symbol !== next.symbol
  ) {
    return false;
  }

  const previousAt = Date.parse(previous.observedAt);
  const nextAt = Date.parse(next.observedAt);
  if (!Number.isFinite(previousAt) || !Number.isFinite(nextAt) || nextAt < previousAt) return false;
  if (TERMINAL_STATES.has(previous.state)) return false;
  return ALLOWED_TRANSITIONS[previous.state].includes(next.state);
}

/**
 * Replays persisted audit evidence deterministically. Invalid, duplicate, stale,
 * or non-authoritative records are ignored rather than inventing portfolio state.
 */
export function replayDividendLifecycleAudit(
  records: readonly DividendLifecycleAuditRecord[],
): DividendLifecycleAuditRecord | undefined {
  const ordered = [...records].sort((a, b) => {
    const byTime = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    return byTime || a.auditId.localeCompare(b.auditId);
  });

  let current: DividendLifecycleAuditRecord | undefined;
  const seen = new Set<string>();
  for (const record of ordered) {
    if (seen.has(record.auditId)) continue;
    seen.add(record.auditId);
    if (!validateDividendLifecycleAuditTransition(current, record)) continue;
    current = record;
  }
  return current;
}

/**
 * Deterministic recovery assertion helper for provider-free tests.
 * Returns true only when replay reaches the expected state and duplicate evidence
 * does not change the recovered result.
 */
export function verifyDividendLifecycleRecovery(
  records: readonly DividendLifecycleAuditRecord[],
  expectedState: DividendLifecycleAuditState,
): boolean {
  const recovered = replayDividendLifecycleAudit(records);
  const deduped = replayDividendLifecycleAudit(Array.from(new Map(records.map(record => [record.auditId, record])).values()));
  return recovered?.state === expectedState && recovered?.auditId === deduped?.auditId;
}
