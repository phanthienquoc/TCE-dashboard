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
  currentPrice: number | null;
  currentPriceDate: string | null;
  dividendYieldPct: number | null;
  oneYearLow: number | null;
  oneYearHigh: number | null;
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
  current_price: number | string | null;
  current_price_date: string | null;
  dividend_yield_pct: number | string | null;
  one_year_low: number | string | null;
  one_year_high: number | string | null;
  crawled_at: string | null;
};

@Injectable()
export class StockEventsSupabaseRepository {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getUpcoming(limit: number): Promise<StockEvent[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const { data, error } = await this.supabase.db
      .from('tce_stock_event_market_metrics')
      .select('id,mongo_id,symbol,ex_right_date,gdkhq_timestamp,payment_date,event_content,ratio_text,dividend_value,reference_price,current_price,current_price_date,dividend_yield_pct,one_year_low,one_year_high,crawled_at')
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
        price: row.current_price == null ? (row.reference_price == null ? null : Number(row.reference_price)) : Number(row.current_price),
        currentPrice: row.current_price == null ? null : Number(row.current_price),
        currentPriceDate: row.current_price_date,
        dividendYieldPct: row.dividend_yield_pct == null ? null : Number(row.dividend_yield_pct),
        oneYearLow: row.one_year_low == null ? null : Number(row.one_year_low),
        oneYearHigh: row.one_year_high == null ? null : Number(row.one_year_high),
        crawledAt: row.crawled_at,
      }))
      .filter(row => row.ticker && row.exDividendDate);
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  return value ? String(value) : null;
}
