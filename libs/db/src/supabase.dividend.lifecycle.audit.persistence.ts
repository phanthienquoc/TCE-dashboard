import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DividendLifecycleAuditEvidence,
  DividendLifecycleAuditRecord,
  DividendLifecycleAuditPersistencePort,
} from '@tce/tce';

export class SupabaseDividendLifecycleAuditPersistence
  implements DividendLifecycleAuditPersistencePort
{
  constructor(private readonly db: SupabaseClient) {}

  async append(record: DividendLifecycleAuditRecord): Promise<'APPENDED' | 'DUPLICATE'> {
    validateRecord(record);

    const { error } = await this.db.from('tce_dividend_lifecycle_audit').insert({
      audit_id: record.auditId,
      account_id: record.accountId,
      environment: record.environment,
      event_id: record.eventId,
      symbol: record.symbol,
      state: record.state,
      observed_at: record.observedAt,
      source_revision: record.sourceRevision,
      authoritative: record.authoritative,
      evidence_hash: record.evidenceHash,
    });

    if (!error) return 'APPENDED';
    if (error.code === '23505') return 'DUPLICATE';
    throw error;
  }

  async list(
    accountId: string,
    environment: DividendLifecycleAuditEvidence['environment'],
    eventId: string,
  ): Promise<readonly DividendLifecycleAuditRecord[]> {
    validateIdentity(accountId, environment, eventId);

    const { data, error } = await this.db
      .from('tce_dividend_lifecycle_audit')
      .select('*')
      .eq('account_id', accountId)
      .eq('environment', environment)
      .eq('event_id', eventId)
      .order('observed_at', { ascending: true })
      .order('audit_id', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(mapRow);
  }
}

function validateIdentity(
  accountId: string,
  environment: DividendLifecycleAuditEvidence['environment'],
  eventId: string,
): void {
  if (!accountId.trim() || !environment || !eventId.trim()) {
    throw new Error('accountId, environment and eventId are required');
  }
}

function validateRecord(record: DividendLifecycleAuditRecord): void {
  validateIdentity(record.accountId, record.environment, record.eventId);
  if (!record.symbol.trim() || !record.sourceRevision.trim() || !record.auditId.trim()) {
    throw new Error('symbol, sourceRevision and auditId are required');
  }
  if (!record.evidenceHash.trim() || !Number.isFinite(Date.parse(record.observedAt))) {
    throw new Error('evidenceHash and valid observedAt are required');
  }
  if (!record.authoritative) throw new Error('authoritative evidence is required');
}

function mapRow(row: Record<string, unknown>): DividendLifecycleAuditRecord {
  return {
    auditId: String(row.audit_id),
    accountId: String(row.account_id),
    environment: row.environment as DividendLifecycleAuditEvidence['environment'],
    eventId: String(row.event_id),
    symbol: String(row.symbol),
    state: row.state as DividendLifecycleAuditEvidence['state'],
    observedAt: String(row.observed_at),
    sourceRevision: String(row.source_revision),
    authoritative: Boolean(row.authoritative),
    evidenceHash: String(row.evidence_hash),
  };
}
