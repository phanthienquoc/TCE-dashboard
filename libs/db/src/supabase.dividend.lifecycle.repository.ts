import type { SupabaseClient } from '@supabase/supabase-js';
import type { TceDividendLifecycleRepository, TceDividendLifecycleRecord } from '@tce/tce';

export class SupabaseDividendLifecycleRepository implements TceDividendLifecycleRepository {
  constructor(private readonly db: SupabaseClient) {}

  async get(accountId: string, environment: string, eventId: string): Promise<TceDividendLifecycleRecord | undefined> {
    validateIdentity(accountId, environment, eventId);

    const { data, error } = await this.db
      .from('tce_dividend_lifecycles')
      .select('*')
      .eq('account_id', accountId)
      .eq('environment', environment)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : undefined;
  }

  async save(record: TceDividendLifecycleRecord): Promise<TceDividendLifecycleRecord> {
    validateIdentity(record.accountId, record.environment, record.eventId);
    if (!record.symbol || !record.exDividendAt || !record.source) {
      throw new Error('symbol, exDividendAt and source are required');
    }

    const row = {
      account_id: record.accountId,
      environment: record.environment,
      symbol: record.symbol,
      event_id: record.eventId,
      lifecycle: record.lifecycle,
      ex_dividend_at: record.exDividendAt,
      record_at: record.recordAt ?? null,
      payment_at: record.paymentAt ?? null,
      source: record.source,
      source_version: record.sourceVersion ?? null,
      updated_at: record.updatedAt,
    };

    const { data, error } = await this.db
      .from('tce_dividend_lifecycles')
      .upsert(row, { onConflict: 'account_id,environment,event_id' })
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Supabase dividend lifecycle upsert returned no row');
    return mapRow(data);
  }
}

function validateIdentity(accountId: string, environment: string, eventId: string): void {
  if (!accountId || !environment || !eventId) {
    throw new Error('accountId, environment and eventId are required');
  }
}

function mapRow(row: Record<string, unknown>): TceDividendLifecycleRecord {
  return {
    accountId: String(row.account_id),
    environment: String(row.environment),
    symbol: String(row.symbol),
    eventId: String(row.event_id),
    lifecycle: row.lifecycle as TceDividendLifecycleRecord['lifecycle'],
    exDividendAt: String(row.ex_dividend_at),
    recordAt: row.record_at == null ? undefined : String(row.record_at),
    paymentAt: row.payment_at == null ? undefined : String(row.payment_at),
    source: String(row.source),
    sourceVersion: row.source_version == null ? undefined : String(row.source_version),
    updatedAt: String(row.updated_at),
  };
}
