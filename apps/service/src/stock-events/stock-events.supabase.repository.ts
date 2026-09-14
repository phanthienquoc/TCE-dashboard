import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseClientService } from '../db/supabase.client';

export type StockEvent = {
  id: string;
  ticker: string;
  exDividendDate: string;
  exDividendTimestamp: string | null;
  executionDate: string | null;
  eventContent: string;
  dividendRate: string;
  dividendValue: number;
  price: number | null;
  crawledAt: string | null;
};

type StockEventRow = {
  id: string;
  mongo_id: string;
  symbol: string | null;
  ex_right_date: string | null;
  gdkhq_timestamp: string | null;
  payment_date: string | null;
  event_content: string | null;
  ratio_text: string | null;
  dividend_value: number | string | null;
  reference_price: number | string | null;
  crawled_at: string | null;
};

@Injectable()
export class StockEventsSupabaseRepository {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getUpcoming(limit: number): Promise<StockEvent[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data, error } = await this.supabase.db
      .from('stock_events')
      .select('id,mongo_id,symbol,ex_right_date,gdkhq_timestamp,payment_date,event_content,ratio_text,dividend_value,reference_price,crawled_at')
      .gte('gdkhq_timestamp', today.toISOString())
      .order('gdkhq_timestamp', { ascending: true })
      .limit(limit);

    if (error) throw new ServiceUnavailableException(`Stock events Supabase query failed: ${error.message}`);

    return ((data ?? []) as StockEventRow[])
      .map(row => ({
        id: row.mongo_id,
        ticker: row.symbol ?? '',
        exDividendDate: row.ex_right_date ?? normalizeDate(row.gdkhq_timestamp) ?? '',
        exDividendTimestamp: normalizeDate(row.gdkhq_timestamp),
        executionDate: row.payment_date,
        eventContent: row.event_content ?? '',
        dividendRate: row.ratio_text ?? '',
        dividendValue: Number(row.dividend_value ?? 0),
        price: row.reference_price == null ? null : Number(row.reference_price),
        crawledAt: row.crawled_at,
      }))
      .filter(row => row.ticker && row.exDividendDate);
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  return value ? String(value) : null;
}
